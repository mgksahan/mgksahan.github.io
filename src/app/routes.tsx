import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { HomePage } from "./pages/HomePage";
import { DiaryPage } from "./pages/DiaryPage";
import { InterestsPage } from "./pages/InterestsPage";
import { LoginPage } from "./pages/LoginPage";
import { FitnessPage } from "./pages/FitnessPage";
import { WritePage } from "./pages/WritePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "diary", Component: DiaryPage },
      { path: "interests", Component: InterestsPage },
      { path: "login", Component: LoginPage },
      { path: "fitness", Component: FitnessPage },
      { path: "write", Component: WritePage },
      { path: "album", element: <Navigate to="/fitness" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
