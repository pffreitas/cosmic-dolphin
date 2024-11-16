package job

type ChatterJobArgs struct {
	NoteID int64
	UserID string
	Input  string
}

func (ChatterJobArgs) Kind() string { return "ChatterJob" }
