import { useEffect, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import { FiSidebar } from "react-icons/fi";
import { HiOutlinePencilAlt } from "react-icons/hi";
import cx from "classnames";
import { useDebounce } from "./common/hooks";

type TNote = {
  value: string;
  id: string;
  date: Date;
};

function App() {
  const [note, setNote] = useState<TNote>({
    value: "",
    id: uuidv4(),
    date: new Date(),
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedNotes: TNote[] =
    JSON.parse(localStorage.getItem("savedNotes") || "[]") || [];

  const [notes, setNotes] = useState<TNote[]>(savedNotes);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const debounce = useDebounce();

  const saveNote = useCallback(() => {
    const { id } = note;

    const existingNote = notes.find((n) => n.id === id);
    if (existingNote) {
      // update old note
      const updatedNote = { ...existingNote, value: note.value };
      const updatedNotes = notes.map((n) => (n.id === id ? updatedNote : n));
      setNotes(() => updatedNotes);
    } else {
      // new note
      if (note.value) {
        setNotes((prev) => [...prev, note]);
      }
    }
  }, [note, notes]);

  useEffect(() => {
    localStorage.setItem("savedNotes", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    debounce(saveNote);
  }, [debounce, note, saveNote]);

  useEffect(() => {
    function handleSaveShortcut(e: WindowEventMap["keydown"]) {
      // For Windows/Linux: Ctrl+S
      // For Mac: ⌘+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNote();
      }
    }
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [saveNote]);

  function handleSideBarLeftClick() {
    setIsSidebarOpen((prev) => !prev);
  }

  function handleSelectNote(
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    n: TNote
  ) {
    if (e) e.preventDefault();

    if (!n.id) return;

    setNote(() => n);
    textareaRef.current?.focus();
  }

  function handleCreateNewNote() {
    if (!note.value) return;
    // save current unsaved
    saveNote();
    // create a new empty note and add it in the state but don't save it yet
    const newNote = {
      value: "",
      id: uuidv4(),
      date: new Date(),
    };
    setNote(() => newNote);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex">
      <div className={cx("mt-2", isSidebarOpen ? "min-w-[15%]" : "min-w-[2%]")}>
        <div className="flex items-center justify-between">
          {isSidebarOpen ? (
            <div className="ml-4 flex items-center justify-between">
              <img
                src="dain-transparent.png"
                width={25}
                className="mr-2"
              />
              <h1 className="text-2xl">
                <span className="text-gray-400">D</span>ain
              </h1>
            </div>
          ) : null}
          <div
            className={cx("w-full", isSidebarOpen ? "text-end" : "text-center")}
          >
            <button
              onClick={handleSideBarLeftClick}
              className="ml-2 btn btn-ghost border-0 rounded-md px-3"
            >
              <FiSidebar className="text-lg" />
            </button>
          </div>
        </div>
        {isSidebarOpen ? (
          <div className="ml-4 mt-6">
            <div className="flex items-center">
              <p className="text-md text-gray-600">Journals</p>
              <button
                onClick={handleCreateNewNote}
                className="ml-2 btn btn-ghost border-0 rounded-md p-1.5 w-fit h-fit"
              >
                <HiOutlinePencilAlt />
              </button>
            </div>
            <div className="mt-4 mr-2 flex flex-col items-start ">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className={cx(
                    " p-2 btn btn-ghost flex items-center justify-start rounded-md w-full",
                    note.id === n.id ? "btn-active" : ""
                  )}
                  onClick={(e) => handleSelectNote(e, n)}
                >
                  <p className="text-left font-medium">
                    {n.value.slice(0, 25) +
                      (n.value.length > 25 ? "..." : "") || "Empty Journal"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="m-0 divider divider-horizontal"></div>
      <div className="w-full h-screen">
        <div className="w-[55%] mx-auto">
          <textarea
            ref={textareaRef}
            value={note.value}
            onChange={(e) => {
              setNote((prev) => ({ ...prev, value: e.target.value }));
            }}
            spellCheck={false}
            autoFocus
            className="textarea textarea-ghost text-2xl w-full h-screen focus:outline-none transition-opacity duration-200 leading-relaxed resize-none"
            placeholder="Type your thoughts out & let your brain breathe..."
          ></textarea>
        </div>
      </div>
    </div>
  );
}

export default App;
