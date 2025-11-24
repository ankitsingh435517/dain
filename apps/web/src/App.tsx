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
import { zodResolver } from "@hookform/resolvers/zod";
import cx from "classnames";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { useDebounce } from "./common/hooks";
import { api, AuthContext } from "./main";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { Box } from "@mui/material";

type TUnsavedNote = {
  _id?: string;
  value: string;
  date: Date;
};

type TNote = {
  _id?: string;
  value: string;
  date: Date;
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
      console.log("res: ", res);
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
      console.log("res: ", res);
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

function useCreateNote(afterCreate?: (note: TNote) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["createNote"],
    mutationFn: async (data: { value: string; date: Date }) => {
      return api.post("/notes", data).then((res) => {
        if (!res.data.ok) {
          throw new Error(res.data.message || "Create note failed");
        }
        return res.data.note;
      });
    },
    onError: (error) => {
      toast.error(
        `Create note error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: (res) => {
      if (afterCreate) {
        afterCreate(res);
      }
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["updateNote"],
    mutationFn: async (data: { id: string; value: string; date: Date }) => {
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
      // FIXME: Temp fix, need to move each note to a separate query to avoid refetching all notes and the update must trigger in a more performant way when apropriate
      //   qc.invalidateQueries({ queryKey: ["notes"] });
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
        className="input input-bordered w-64"
        {...props}
        onFocus={() => setIsInteracted(true)}
      />
      {type === "password" && isInteracted ? (
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-gray-600 cursor-pointer"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
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
  const { data: notes, isLoading: isFetchingNotes } = useFetchNotes();
  const [note, setNote] = useState<TUnsavedNote>({
    _id: "",
    value: "",
    date: new Date(),
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const debounce = useDebounce();

  const saveNoteMutation = useCreateNote((savedNote) => {
    setNote(savedNote);
    // update url to include note id
    const url = new URL(window.location.href);
    url.searchParams.set("noteId", savedNote._id!);
    window.history.pushState({}, "", url.toString());
  });
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  const saveNote = useCallback(() => {
    if (!note.value) return;
    const { _id } = note as TNote;
    if (_id) {
      // if nothing changed, don't update
      const existingNote = notes?.find((n: TNote) => n._id === _id);
      if (
        existingNote?.value === note.value &&
        existingNote?.date === note.date
      ) {
        return;
      }
      // its an update to existing note
      updateNoteMutation.mutate({
        id: _id,
        value: note.value,
        date: note.date,
      });
      return;
    }
    // save note to backend
    saveNoteMutation.mutate({ value: note.value, date: note.date });
  }, [note, saveNoteMutation.mutate, updateNoteMutation.mutate, notes?.find]);

  useEffect(() => {
    if (!notes?.length) return;

    const urlParams = new URLSearchParams(window.location.search);
    const noteId = urlParams.get("noteId");

    if (!noteId) return;

    const noteToOpen = notes.find((n: TNote) => n._id === noteId);

    if (!noteToOpen) return;

    setNote(noteToOpen);
  }, [notes]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    debounce(saveNote);
  }, [debounce, note, saveNote]);

  function handleSideBarLeftClick() {
    setIsSidebarOpen((prev) => !prev);
  }

  function handleSelectNote(
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    n: TNote
  ) {
    if (e) e.stopPropagation();

    if (!n._id) return;

    setNote(() => n);
    textareaRef.current?.focus();
    // update url to include note id
    const url = new URL(window.location.href);
    url.searchParams.set("noteId", n._id);
    window.history.pushState({}, "", url.toString());
  }

  function handleCreateNewUnsavedNote() {
    if (!note.value) return;
    // save current unsaved
    saveNote();
    // create a new empty note and add it in the state but don't save it yet
    const newNote = {
      value: "",
      date: new Date(),
    };
    setNote(() => newNote);
    textareaRef.current?.focus();
    // remove noteId from url
    const url = new URL(window.location.href);
    url.searchParams.delete("noteId");
    window.history.pushState({}, "", url.toString());
  }

  const [menu, setMenu] = useState<null | HTMLElement>(null);
  const [selectedNote, setSelectedNote] = useState<null | string>(null);
  const [deleteNote, setDeleteNote] = useState<null | boolean>(null);

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
    setSelectedNote(noteId);
  }

  function handleOpenDeleteSelectedNote(
    e: React.MouseEvent<HTMLElement, MouseEvent>
  ) {
    e.stopPropagation();
    e.preventDefault();
    setDeleteNote(true);
  }

  function handleDeleteSelectedNote(
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) {
    e.stopPropagation();
    if (!selectedNote) return;
    // mutation to delete note
    deleteNoteMutation.mutate(selectedNote);
    // close dialog
    setDeleteNote(null);
    setMenu(null);
    // if the deleted note is currently opened, clear the editor
    if ((note as TNote)._id === selectedNote) {
      setNote({ value: "", date: new Date() });
    }
  }

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
              <p className="text-md text-gray-600">Journals</p>
              <button
                type="button"
                onClick={handleCreateNewUnsavedNote}
                className="ml-2 btn btn-ghost border-0 rounded-md p-1.5 w-fit h-fit"
              >
                <HiOutlinePencilAlt />
              </button>
            </div>
            <div className="mt-4 mr-2 flex flex-col items-start">
              {isFetchingNotes && <p>Loading notes...</p>}
              {notes.map((n: TNote) => (
                <Box
                  key={n._id}
                  className={cx(
                    " p-2 btn btn-ghost flex items-center justify-start rounded-md w-full",
                    note?._id === n?._id ? "btn-active" : ""
                  )}
                  onClick={(e) => handleSelectNote(e, n)}
                >
                  <p className="text-left font-medium w-[90%]">
                    {n.value.slice(0, 25) +
                      (n.value.length > 25 ? "..." : "") || "Empty Journal"}
                  </p>
                  {/* More icon */}
                  <div className="">
                    <IconButton
                      onClick={(e) => {
                        handleShowSavedNoteOptions(e, n?._id);
                      }}
                      className={cx(
                        "p-1 opacity-0 hover:opacity-100 transition-opacity",
                        selectedNote === n._id && "opacity-100"
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
        <div className="w-[55%] mx-auto">
          <textarea
            ref={textareaRef}
            value={note.value}
            onChange={(e) => {
              setNote((prev) => ({ ...prev, value: e.target.value }));
            }}
            spellCheck={false}
            // biome-ignore lint/a11y/noAutofocus: <explanation>
            autoFocus
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
        open={!!deleteNote}
        onClose={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
          e.stopPropagation();
          setDeleteNote(null);
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
              setDeleteNote(null);
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
