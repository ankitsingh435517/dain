import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import { FiSidebar } from "react-icons/fi";
import { HiOutlinePencilAlt } from "react-icons/hi";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import cx from "classnames";
import { Eye, EyeOff } from "lucide-react";
import { useDebounce } from "./common/hooks";

type TNote = {
  value: string;
  id: string;
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
  return useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: {
      email: string;
      username: string;
      password: string;
    }) => {
        // TODO: connect with backend api
      return fetch("/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Sign up failed");
        }
        return res.json();
      });
    },
    onError: (error) => {
      toast.error(
        `Sign up error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: () => {
      toast.success("Sign up successful!");
    },
  });
}

function useLogin() {
  return useMutation({
    mutationKey: ["login"],
    mutationFn: async (data: { usernameOrEmail: string; password: string }) => {
      return fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Login failed");
        }
        return res.json();
      });
    },
    onError: (error) => {
      toast.error(
        `Login error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    },
    onSuccess: () => {
      toast.success("Login successful!");
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
      {type === "password" && isInteracted? (
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
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

  // TODO:
  // Add auth (signup, login, logout)
  const isLoggedIn = false;
  if (!isLoggedIn) {
    return <LoginRegisterScreen />;
  }
  // connect backend api to store and fetch journals
  // use Lists and ListItem (secondaryAction prop give more icon to be added) - use it for journal list in sidebar
  // move on to the next features of Dain

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
                type="button"
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
