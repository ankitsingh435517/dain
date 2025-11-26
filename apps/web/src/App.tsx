import { useEffect, useState, useCallback, useRef, useContext } from "react";
import { toast } from "sonner";
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import "./App.css";
import { FiSidebar } from "react-icons/fi";
import { HiOutlinePencilAlt } from "react-icons/hi";
import { z } from "zod";
import { v4 } from "uuid";
import { zodResolver } from "@hookform/resolvers/zod";
import cx from "classnames";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { api, AuthContext } from "./main";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(localizedFormat);

type TUnsavedNote = {
  id: string;
  value: string;
  updatedAt?: Date;
  title: string;
};

type TNote = {
  id: string;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
  value: string;
};

const schema = {
  register: z.object({
    email: z
      .string()
      .nonempty({ message: "Email is required" })
      .email({ message: "Invalid email address" }),
    username: z
      .string()
      .nonempty({ message: "Username is required" })
      .min(3, { message: "Username must be at least 3 characters" }),
    password: z
      .string()
      .nonempty({ message: "Password is required" })
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
      .string()
      .nonempty({ message: "Password is required" })
      .min(6, { message: "Confirm Password must be at least 6 characters" }),
  }),
  login: z.object({
    usernameOrEmail: z
      .string()
      .nonempty({ message: "Username or Email is required" }),
    password: z
      .string()
      .nonempty({ message: "Password is required" })
      .min(6, { message: "Password must be at least 6 characters" }),
  }),
};

function useSignUp() {
  const { handleSaveUser } = useContext(AuthContext);

  return useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: {
      email: string;
      username: string;
      password: string;
    }) => {
      return api.post("/signup", data).then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Signup failed");
        }
        return res.data;
      });
    },
    onError: (error) => {
      toast.error(
        `Sign up error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: (res) => {
      if (!res.ok) {
        throw new Error("Sign up failed");
      }
      // set authorization headers
      api.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${res.accessToken}`;
      toast.success("Sign up successful!");
      handleSaveUser(res.user);
    },
  });
}

function useLogin() {
  const { handleSaveUser } = useContext(AuthContext);

  return useMutation({
    mutationKey: ["login"],
    mutationFn: async (data: { usernameOrEmail: string; password: string }) => {
      return api.post("/login", data).then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Login failed");
        }
        return res.data;
      });
    },
    onError: (error) => {
      toast.error(
        `Login error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(`Login error: ${res.message || "Unknown error"}`);
        return;
      }
      toast.success("Login successful!");
      // set authorization headers
      api.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${res.accessToken}`;
      handleSaveUser(res.user);
    },
  });
}

function useLogout() {
  const { handleSaveUser } = useContext(AuthContext);

  return useMutation({
    mutationKey: ["logout"],
    mutationFn: async () => {
      return api.post("/logout").then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Logout failed");
        }
        return res.data;
      });
    },
    onError: (error) => {
      toast.error(
        `Logout error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: (res) => {
      if (!res.ok) {
        throw new Error("Logout failed");
      }
      // clear user from context
      handleSaveUser(null);
      // remove authorization header
      delete api.defaults.headers.common["Authorization"];
      toast.success("Logged out successfully");
    },
  });
}

function useFetchNotes() {
  const { user } = useContext(AuthContext);

  return useQuery({
    queryKey: ["notes", user?._id],
    queryFn: async () => {
      return api.get("/notes").then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Fetch notes failed");
        }
        return res.data.notes;
      });
    },
    enabled: !!user,
  });
}

function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["updateNote"],
    mutationFn: async (data: { id: string; value: string; title: string }) => {
      return api.put(`/notes/${data.id}`, data).then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Update note failed");
        }
        return res.data.note;
      });
    },
    onError: (error) => {
      toast.error(
        `Update note error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["note"] });
    },
  });
}

function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["deleteNote"],
    mutationFn: async (id: string) => {
      return api.delete(`/notes/${id}`).then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Delete note failed");
        }
        return res.data;
      });
    },
    onError: (error) => {
      toast.error(
        `Delete note error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted successfully");
    },
  });
}

function TextFieldInput({
  type,
  helperText,
  ...props
}: {
  placeholder: string;
  type: string;
  helperText?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const [isInteracted, setIsInteracted] = useState(false);
  let typeToUse = type;
  if (type === "password") {
    typeToUse = show ? "text" : "password";
  }
  return (
    <div className="flex flex-col mb-4 relative">
      <input
        type={typeToUse}
        className="input input-bordered w-64 relative"
        {...props}
        onFocus={() => setIsInteracted(true)}
      />
      {type === "password" && isInteracted ? (
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-5 -translate-y-1/2 z-10 text-gray-600 cursor-pointer"
        >
          {show ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      ) : null}
      {helperText ? (
        <span className="text-sm text-gray-500 mt-1">{helperText}</span>
      ) : null}
    </div>
  );
}

function RegisterScreen({
  handleToggleRegister,
}: {
  handleToggleRegister: () => void;
}) {
  const signUpMutation = useSignUp();

  const { register, handleSubmit, formState, setError } = useForm({
    mode: "onSubmit",
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(schema.register),
  });
  const { errors } = formState;
  const onSubmit = (data: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (data.password !== data.confirmPassword) {
      setError("confirmPassword", {
        type: "manual",
        message: "Passwords do not match",
      });
      //   toast.error("Passwords do not match");
      return;
    }
    if (signUpMutation.isPending) return;
    signUpMutation.mutate({
      email: data.email,
      username: data.username,
      password: data.password,
    });
  };

  const isRegistering = signUpMutation.isPending;

  if (isRegistering) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Registering...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-3xl mb-6">Create an Account</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="text-center">
        <div className="mb-4 flex flex-col">
          <TextFieldInput
            {...register("email", { required: "Email is required" })}
            type="text"
            placeholder="Email"
            helperText={errors.email?.message}
          />
          <TextFieldInput
            {...register("username", { required: "Username is required" })}
            type="text"
            placeholder="Username"
            helperText={errors.username?.message}
          />
          <TextFieldInput
            {...register("password", { required: "Password is required" })}
            type="password"
            placeholder="Password"
            helperText={errors.password?.message}
          />
          <TextFieldInput
            {...register("confirmPassword", {
              required: "Confirm Password is required",
            })}
            type="password"
            placeholder="Confirm Password"
            helperText={errors.confirmPassword?.message}
          />
        </div>
        <button className="btn btn-secondary btn-lg" type="submit">
          Sign Up
        </button>
      </form>
      <h5 className="mt-4 flex items-center">
        Already have an account?{" "}
        <button
          type="button"
          className="btn btn-link text-blue-500"
          onClick={handleToggleRegister}
        >
          Login
        </button>
      </h5>
    </div>
  );
}

function LoginScreen({
  handleToggleRegister,
}: {
  handleToggleRegister: () => void;
}) {
  const loginMutation = useLogin();

  const { register, handleSubmit, formState } = useForm({
    mode: "onSubmit",
    defaultValues: {
      usernameOrEmail: "",
      password: "",
    },
    resolver: zodResolver(schema.login),
  });
  const { errors } = formState;

  const onSubmit = (data: { usernameOrEmail: string; password: string }) => {
    if (loginMutation.isPending) return;
    loginMutation.mutate({
      usernameOrEmail: data.usernameOrEmail,
      password: data.password,
    });
  };

  const isLoggingIn = loginMutation.isPending;

  if (isLoggingIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Logging in...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-3xl mb-6">Welcome to Dain</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="text-center">
        <div className="mb-4 flex flex-col">
          <TextFieldInput
            type="text"
            {...register("usernameOrEmail", {
              required: "Username or Email is required",
            })}
            placeholder="Username or Email"
            helperText={errors.usernameOrEmail?.message}
          />
          <TextFieldInput
            type="password"
            {...register("password", { required: "Password is required" })}
            placeholder="Password"
            helperText={errors.password?.message}
          />
        </div>
        <button className="btn btn-secondary btn-lg" type="submit">
          Login
        </button>
      </form>
      <h5 className="mt-4 flex items-center">
        Don't have an account?{" "}
        <button
          type="button"
          className="btn btn-link text-blue-500"
          onClick={handleToggleRegister}
        >
          Sign up
        </button>
      </h5>
    </div>
  );
}

function LoginRegisterScreen() {
  const [isRegister, setIsRegister] = useState(false);
  if (isRegister) {
    return <RegisterScreen handleToggleRegister={() => setIsRegister(false)} />;
  }
  return <LoginScreen handleToggleRegister={() => setIsRegister(true)} />;
}

function App() {
  // maintain notes state locally in localstorage, and periodically save to backend
  const notesInLocalStorage = localStorage.getItem("notes");
  const parsedNotesInLocalStorage = notesInLocalStorage
    ? JSON.parse(notesInLocalStorage)
    : null;
  const [note, setNote] = useState<TUnsavedNote>({
    value: "",
    title: "",
    id: v4(),
  });
  // notes in backend
  const { data: notesFromBackend } = useFetchNotes();

  // on mount, sync the notes from backend to localstorage - **working for now but monitor for conflicts later**
  useEffect(() => {
    if (notesFromBackend && notesFromBackend.length > 0) {
      let existingNotes: TNote[] = [];
      const notesInLocalStorage = localStorage.getItem("notes");
      if (notesInLocalStorage) {
        existingNotes = JSON.parse(notesInLocalStorage);
      }
      // merge notes from backend to localstorage
      notesFromBackend.forEach((backendNote: TNote) => {
        const noteIndex = existingNotes.findIndex(
          (n) => n.id === backendNote.id
        );
        if (noteIndex !== -1) {
          // update existing note
          existingNotes[noteIndex] = {
            ...existingNotes[noteIndex],
            value: backendNote.value,
            title: backendNote.title,
            updatedAt: backendNote.updatedAt,
            createdAt: backendNote.createdAt,
          };
        } else {
          // add new note
          existingNotes.push({
            ...backendNote,
          });
        }
      });
      localStorage.setItem("notes", JSON.stringify(existingNotes));
    }
  }, [notesFromBackend]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  const saveNote = useCallback(() => {
    if (!note.value) return;

    // if there are changes, save to backend
    const shouldSaveToBackend = notesFromBackend?.find(
      (n: TNote) => n.id === note.id
    );
    if (
      !shouldSaveToBackend ||
      shouldSaveToBackend.value !== note.value ||
      shouldSaveToBackend.title !== note.title
    ) {
      updateNoteMutation.mutate({
        id: note.id,
        value: note.value,
        title: note.title,
      });
    }
  }, [note, updateNoteMutation.mutate, notesFromBackend?.find]);

  // save note to backend every 5 seconds if there are changes
  useEffect(() => {
    const interval = setInterval(() => {
      saveNote();
    }, 5000);
    return () => clearInterval(interval);
  }, [saveNote]);

  function handleSideBarLeftClick() {
    setIsSidebarOpen((prev) => !prev);
  }

  function handleSelectNote(
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    n: TNote
  ) {
    if (e) e.stopPropagation();

    saveNote();
    // load selected note
    setNote(() => n);
    textareaRef.current?.focus();
  }

  function handleCreateNewUnsavedNote() {
    if (!note.value) return;
    // save current unsaved
    saveNote();
    // create a new empty note and add it in the state but don't save it yet
    const newNote = {
      value: "",
      title: "Unsaved Note",
      date: new Date(),
      id: v4(),
    };
    setNote(() => newNote);
    textareaRef.current?.focus();
  }

  const [menu, setMenu] = useState<null | HTMLElement>(null);

  const [action, setAction] = useState<{
    type: string;
    payload: Record<string, unknown>;
  }>({ type: "", payload: {} });

  const onAction = (actionType: string, payload: Record<string, unknown>) => {
    setAction({ type: actionType, payload });
  };

  const closeAction = () => {
    setAction({ type: "", payload: {} });
  };

  function handleShowSavedNoteOptions(
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    noteId?: string
  ) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setMenu(e.currentTarget);
    if (!noteId) return;
    onAction("showOptions", { noteId });
  }

  function handleOpenDeleteSelectedNote(
    e: React.MouseEvent<HTMLElement, MouseEvent>
  ) {
    e.stopPropagation();
    e.preventDefault();
    onAction("deleteNote", { noteId: action.payload.noteId });
  }

  function handleDeleteSelectedNote(
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) {
    e.stopPropagation();
    if (!action.payload.noteId) return;
    // delete note from localstorage
    let existingNotes: TNote[] = [];
    const notesInLocalStorage = localStorage.getItem("notes");
    if (notesInLocalStorage) {
      existingNotes = JSON.parse(notesInLocalStorage);
    }
    const updatedNotes = existingNotes.filter(
      (n) => n.id !== (action.payload.noteId as string)
    );
    localStorage.setItem("notes", JSON.stringify(updatedNotes));
    // mutation to delete note
    deleteNoteMutation.mutate(action.payload.noteId as string);
    setMenu(null);
    // close dialog
    closeAction();
    // if the deleted note is currently opened, clear the editor
    if ((note as TNote).id === action.payload.noteId) {
      setNote({ value: "", title: "", id: v4() });
      textareaRef.current?.focus();
    }
  }

  const saveInLocalStorage = (noteToSave: TUnsavedNote) => {
    let existingNotes: TNote[] = [];
    const notesInLocalStorage = localStorage.getItem("notes");
    if (notesInLocalStorage) {
      existingNotes = JSON.parse(notesInLocalStorage);
    }
    // check if note already exists in localstorage
    const noteIndex = existingNotes.findIndex(
      (n) => n.id === (noteToSave as TNote).id
    );
    if (noteIndex !== -1) {
      // update existing note
      existingNotes[noteIndex] = {
        ...existingNotes[noteIndex],
        value: noteToSave.value,
        title: noteToSave.title,
        updatedAt: new Date(),
        id: noteToSave.id,
      };
    } else {
      // add new note
      existingNotes.push({
        ...noteToSave,
        id: noteToSave.id,
        updatedAt: new Date(),
      });
    }
    localStorage.setItem("notes", JSON.stringify(existingNotes));
  };

  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const { user } = useContext(AuthContext);

  // jsx
  const isFetchingAuth = useIsFetching({ queryKey: ["auth"] });
  if (isFetchingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }
  const isLoggedIn = !!user;
  if (!isLoggedIn) {
    return <LoginRegisterScreen />;
  }
  return (
    <div className="flex">
      <div className={cx("mt-2", isSidebarOpen ? "min-w-[15%]" : "min-w-[2%]")}>
        <div className="flex items-center justify-between">
          {isSidebarOpen ? (
            <div className="ml-4 flex items-center justify-between">
              <img
                src="dain.svg"
                width={25}
                className="mr-2 w-[25px]"
                alt="Logo"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
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
              type="button"
              onClick={handleSideBarLeftClick}
              className="ml-2 btn btn-ghost border-0 rounded-md px-3"
            >
              <FiSidebar className="text-lg" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={cx(
                "ml-1 btn btn-ghost border-0 rounded-md px-3 absolute left-0 bottom-0 mb-2"
              )}
            >
              <LogOut className="text-lg" height={18} />
              {isSidebarOpen ? <span className="mr-2">Logout</span> : null}
            </button>
          </div>
        </div>
        {isSidebarOpen ? (
          <div className="ml-4 mt-6">
            <div className="flex items-center">
              <p className="text-md text-gray-600">Notes</p>
              <button
                type="button"
                onClick={handleCreateNewUnsavedNote}
                className="ml-2 btn btn-ghost border-0 rounded-md p-1.5 w-fit h-fit"
              >
                <HiOutlinePencilAlt />
              </button>
            </div>
            <div className="mt-4 mr-2 flex flex-col items-start">
              {parsedNotesInLocalStorage?.map((n: TNote) => (
                <Box
                  key={n.id}
                  className={cx(
                    " p-2 btn btn-ghost flex items-center justify-start rounded-md w-full",
                    note?.id === n?.id ? "btn-active" : ""
                  )}
                  onClick={(e) => handleSelectNote(e, n)}
                >
                  <p className="text-left font-medium w-[90%]">
                    {n.title || "Untitled Note"}
                  </p>
                  {/* More icon */}
                  <div className="">
                    <IconButton
                      onClick={(e) => {
                        handleShowSavedNoteOptions(e, n?.id);
                      }}
                      className={cx(
                        "p-1 opacity-0 hover:opacity-100 transition-opacity",
                        action.payload.noteId === n.id && "opacity-100"
                      )}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </div>
                </Box>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="m-0 divider divider-horizontal"></div>
      <div className="w-full h-screen">
        {/* Content editable div for title of the notes */}
        <div className="flex w-[75%] mx-auto mt-4">
          <div
            className="w-[55%] pl-2 mx-auto focus:outline-none transition-opacity duration-200 leading-relaxed resize-none"
            contentEditable
            suppressContentEditableWarning={true}
            autoFocus
            onBlur={(e) => {
              const newTitle = e.currentTarget.textContent || "";
              setNote((prev) => ({ ...prev, title: newTitle }));
              // save the note state locally in localstorage
              saveInLocalStorage({ ...note, title: newTitle });
            }}
          >
            <span className="text-4xl font-normal">
              {(note as TNote).title || "Untitled Note"}
            </span>
          </div>
          <div className="text-right mr-4">
            <div className="mb-2">
              <span className="text-sm text-gray-500">Logged in as: </span>
              <span className="text-sm font-medium">{user?.username}</span>
            </div>
            <span className="text-sm text-gray-500">
              {note.id ? "Last edited: " : "New Note"}{" "}
              {dayjs(note.updatedAt).format("lll")}
            </span>
          </div>
        </div>
        <div className="w-[55%] mx-auto">
          <textarea
            ref={textareaRef}
            value={note.value}
            onChange={(e) => {
              setNote((prev) => ({ ...prev, value: e.target.value }));
              // save the note state locally in localstorage
              saveInLocalStorage({ ...note, value: e.target.value });
            }}
            spellCheck={false}
            // biome-ignore lint/a11y/noAutofocus: <explanation>
            // autoFocus
            className="textarea textarea-ghost text-2xl w-full h-screen focus:outline-none transition-opacity duration-200 leading-relaxed resize-none"
            placeholder="Type your thoughts out & let your brain breathe..."
          ></textarea>
        </div>
      </div>

      {/* Menu list */}
      <Menu
        anchorEl={menu}
        open={Boolean(menu)}
        onClose={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
          e.stopPropagation();
          setMenu(null);
        }}
      >
        <MenuItem onClick={(e) => handleOpenDeleteSelectedNote(e)}>
          Delete Note
        </MenuItem>
      </Menu>

      {/* Delete Dialog */}
      <Dialog
        open={!!action.type && action.type === "deleteNote"}
        onClose={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
          e.stopPropagation();
          closeAction();
        }}
        hideBackdrop
      >
        <DialogTitle>Delete Note</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this note? This action cannot be
          undone.
        </DialogContent>
        <DialogActions>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              closeAction();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleDeleteSelectedNote}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default App;
