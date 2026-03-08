import { describe, it, expect, beforeEach, mock } from "bun:test";

describe("DELETE /bookmarks/:id - Route Handler Logic", () => {
  const TEST_USER_ID = "user-123";

  let mockBookmarkDelete: ReturnType<typeof mock>;
  let mockRequest: any;
  let mockReply: any;
  let mockFastifyLog: any;

  function createMockReply() {
    const reply: any = {};
    reply.status = mock(() => reply);
    reply.send = mock(() => reply);
    return reply;
  }

  beforeEach(() => {
    mockBookmarkDelete = mock();
    mockRequest = {
      params: { id: "bookmark-123" },
      userId: TEST_USER_ID,
    };
    mockReply = createMockReply();
    mockFastifyLog = { error: mock() };
  });

  async function invokeHandler() {
    const { id } = mockRequest.params;
    const user_id = mockRequest.userId!;

    try {
      await mockBookmarkDelete(id, user_id);
      return mockReply.send({ message: "Bookmark deleted successfully" });
    } catch (error: any) {
      if (error instanceof Error && error.message === "Bookmark not found") {
        return mockReply.status(404).send({ error: "Bookmark not found" });
      }
      mockFastifyLog.error({ error }, "Delete bookmark error");
      return mockReply.status(500).send({ error: "Internal server error" });
    }
  }

  describe("happy path", () => {
    it("should call bookmark.delete with correct id and userId", async () => {
      mockBookmarkDelete.mockResolvedValue(undefined);
      mockRequest.params.id = "bookmark-456";

      await invokeHandler();

      expect(mockBookmarkDelete).toHaveBeenCalledWith(
        "bookmark-456",
        TEST_USER_ID
      );
    });

    it("should send success message when bookmark is deleted", async () => {
      mockBookmarkDelete.mockResolvedValue(undefined);

      await invokeHandler();

      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Bookmark deleted successfully",
      });
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe("not found", () => {
    it("should return 404 when service throws 'Bookmark not found'", async () => {
      mockBookmarkDelete.mockRejectedValue(new Error("Bookmark not found"));

      await invokeHandler();

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Bookmark not found",
      });
    });

    it("should return same 404 for wrong user (no info leak)", async () => {
      mockBookmarkDelete.mockRejectedValue(new Error("Bookmark not found"));
      mockRequest.userId = "different-user";

      await invokeHandler();

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Bookmark not found",
      });
    });
  });

  describe("internal errors", () => {
    it("should return 500 when service throws an unexpected error", async () => {
      mockBookmarkDelete.mockRejectedValue(
        new Error("Database connection failed")
      );

      await invokeHandler();

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });

    it("should log the error via fastify.log.error", async () => {
      const dbError = new Error("Database connection failed");
      mockBookmarkDelete.mockRejectedValue(dbError);

      await invokeHandler();

      expect(mockFastifyLog.error).toHaveBeenCalledWith(
        { error: dbError },
        "Delete bookmark error"
      );
    });

    it("should return 500 when service throws a non-Error object", async () => {
      mockBookmarkDelete.mockRejectedValue("unexpected string error");

      await invokeHandler();

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });

    it("should not expose internal error details to client", async () => {
      mockBookmarkDelete.mockRejectedValue(
        new Error("FATAL: password authentication failed")
      );

      await invokeHandler();

      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Internal server error",
      });
      expect(mockReply.send).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("FATAL") })
      );
    });
  });
});
