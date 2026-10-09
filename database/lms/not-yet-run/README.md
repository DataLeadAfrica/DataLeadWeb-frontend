# Not yet run

Nothing is waiting. **The database layer is finished.** Files 01 to 07, 10, 11, 12 and 13 have all
been applied to the live database and live in `database/lms/`.

This folder stays so there is an obvious place for the next numbered file, if there ever is one. The
convention, which has now held for four files:

1. A new file arrives here with its verify and undo files, and this README says what it does.
2. It is run on the live database and its verify file is read row by row.
3. Only then do the three files move into `database/lms/`, and the run date goes into
   `docs/lms/STATUS.md`.

Keeping the two folders apart is what stops the repository claiming something has been applied when
it has not.
