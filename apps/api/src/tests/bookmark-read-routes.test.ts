import { describe, it, expect, beforeEach, mock } from "bun:test";

describe("Bookmark read route handler logic", () => {
  const TEST_USER_ID = "user-123";

  let mockFindByUser: ReturnType<typeof mock>;
  let mockFindFeed: ReturnType<typeof mock>;
  let mockMarkRead: ReturnType<typeof mock>;
  let mockMarkUnread: ReturnType<typeof mock>;
  let mockReply: any;
  let mockFastifyLog: any;

  function createMockReply() {
    const reply: any = {};
    reply.status = mock(() => reply);
    reply.send = mock(() => reply);
    return reply;
  }

  beforeEach(() => {
    mockFindByUser = mock();
    mockFindFeed = mock();
    mockMarkRead = mock();
    mockMarkUnread = mock();
    mockReply = createMockReply();
    mockFastifyLog = { error: mock(), info: mock() };
  });

  async function invokeListHandler(query: any = {}) {
    try {
      const {
        collection_id,
        limit = 50,
        offset = 0,
        read_status = "all",
      } = query;

      if (!["all", "unread", "read"].includes(read_status)) {
        return mockReply.status(400).send({ error: "Invalid read_status" });
      }

      const bookmarks = await mockFindByUser(TEST_USER_ID, {
        collectionId: collection_id,
        limit,
        offset,
        includeArchived: false,
        readStatus: read_status,
      });

      return mockReply.send({ bookmarks });
    } catch (error) {
      mockFastifyLog.error({ error }, "Get bookmarks error");
      return mockReply.status(500).send({ error: "Internal server error" });
    }
  }

  async function invokeFeedHandler(query: any = {}) {
    try {
      const { limit = 50, offset = 0 } = query;
      const bookmarks = await mockFindFeed(TEST_USER_ID, { limit, offset });
      return mockReply.send({ bookmarks });
    } catch (error) {
      mockFastifyLog.error({ error }, "Get bookmark feed error");
      return mockReply.status(500).send({ error: "Internal server error" });
    }
  }

  async function invokeMarkReadHandler(id = "bookmark-123") {
    try {
      const bookmark = await mockMarkRead(id, TEST_USER_ID);
      return mockReply.send(bookmark);
    } catch (error) {
      if (error instanceof Error && error.message === "Bookmark not found") {
        return mockReply.status(404).send({ error: "Bookmark not found" });
      }
      mockFastifyLog.error({ error }, "Mark bookmark read error");
      return mockReply.status(500).send({ error: "Internal server error" });
    }
  }

  async function invokeMarkUnreadHandler(id = "bookmark-123") {
    try {
      const bookmark = await mockMarkUnread(id, TEST_USER_ID);
      return mockReply.send(bookmark);
    } catch (error) {
      if (error instanceof Error && error.message === "Bookmark not found") {
        return mockReply.status(404).send({ error: "Bookmark not found" });
      }
      mockFastifyLog.error({ error }, "Mark bookmark unread error");
      return mockReply.status(500).send({ error: "Internal server error" });
    }
  }

  it("should request the unread feed", async () => {
    const bookmark = { id: "bookmark-1", isRead: false };
    mockFindFeed.mockResolvedValue([bookmark]);

    await invokeFeedHandler({ limit: 10, offset: 20 });

    expect(mockFindFeed).toHaveBeenCalledWith(TEST_USER_ID, {
      limit: 10,
      offset: 20,
    });
    expect(mockReply.send).toHaveBeenCalledWith({ bookmarks: [bookmark] });
  });

  it("should pass read_status through library queries", async () => {
    mockFindByUser.mockResolvedValue([]);

    await invokeListHandler({
      collection_id: "collection-1",
      read_status: "read",
    });

    expect(mockFindByUser).toHaveBeenCalledWith(TEST_USER_ID, {
      collectionId: "collection-1",
      includeArchived: false,
      limit: 50,
      offset: 0,
      readStatus: "read",
    });
    expect(mockReply.send).toHaveBeenCalledWith({ bookmarks: [] });
  });

  it("should reject invalid read_status values", async () => {
    await invokeListHandler({ read_status: "finished" });

    expect(mockReply.status).toHaveBeenCalledWith(400);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Invalid read_status",
    });
    expect(mockFindByUser).not.toHaveBeenCalled();
  });

  it("should mark a bookmark read", async () => {
    const updated = {
      id: "bookmark-123",
      isRead: true,
      readAt: "2026-06-17T00:00:00.000Z",
    };
    mockMarkRead.mockResolvedValue(updated);

    await invokeMarkReadHandler();

    expect(mockMarkRead).toHaveBeenCalledWith("bookmark-123", TEST_USER_ID);
    expect(mockReply.send).toHaveBeenCalledWith(updated);
  });

  it("should mark a bookmark unread", async () => {
    const updated = { id: "bookmark-123", isRead: false };
    mockMarkUnread.mockResolvedValue(updated);

    await invokeMarkUnreadHandler();

    expect(mockMarkUnread).toHaveBeenCalledWith("bookmark-123", TEST_USER_ID);
    expect(mockReply.send).toHaveBeenCalledWith(updated);
  });

  it("should return 404 when marking another user's bookmark read", async () => {
    mockMarkRead.mockRejectedValue(new Error("Bookmark not found"));

    await invokeMarkReadHandler();

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Bookmark not found",
    });
  });
});
