import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "./pipeline.tsp";

using TypeSpec.Http;
namespace CosmicDolphinService;

model NoteSection {
    type: NoteSectionType;
    content: Record<string>;
}

enum NoteType {
    fup: "fup",
    chatter: "chatter",
    knowledge: "knowledge",
    task: "task",
}

enum NoteSectionType {
    text: "text",
}

model Note {
    id?: int64;
    documentId?: int64;
    title: string;
    summary: string;
    body: string;
    tags?: string[];
    type: NoteType;
    userId: string;
    createdAt: string;
    resources?: Resource[];
}

model CreateNoteRequest {
    body: string;
    type: NoteType;
}

model OpenGraph {
    type?: string;
    url?: string;
    title?: string;
    description?: string;
    siteName?: string;
    image?: string;
    imageAlt?: string;
    imageWidth?: int32;
    imageHeight?: int32;
    articlePublishedTime?: string;
    articleModifiedTime?: string;
}

model Resource {
    type: ResourceType;
    openGraph?: OpenGraph;
}

enum ResourceType {
    web_page: "web_page",
    image: "image",
}

@route("/notes")
@tag("Notes")
interface Notes {
    @useAuth(BearerAuth)
    @get
    findAll(): Note[] | CosmicError;

    @useAuth(BearerAuth)
    @get
    findById(@path id: string): Note | CosmicError;

    @useAuth(BearerAuth)
    @post
    create(@body request: CreateNoteRequest): {
        @statusCode statusCode: 201;
        @body body: Note;
    };
}
