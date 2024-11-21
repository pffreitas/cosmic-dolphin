
ALTER TABLE resources
ADD COLUMN note_id INT,
ADD CONSTRAINT fk_note
FOREIGN KEY (note_id) REFERENCES notes(id);