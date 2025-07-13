package notes

type NotesProcessor interface {
	ProcessNote(noteID int64, userID string) error
}

var notesProcessors []NotesProcessor = []NotesProcessor{}

func AddNotesProcessor(processor NotesProcessor) {
	notesProcessors = append(notesProcessors, processor)
}

func CreateNote(body string, noteType NoteType, userID string) (*Note, error) {
	note, err := InsertNote(Note{
		Type:     noteType,
		RawBody:  body,
		Body:     body,
		Sections: []NoteSection{},
		Tags:     []string{},
		UserID:   userID,
	})

	if err != nil {
		return nil, err
	}

	return note, nil
}
