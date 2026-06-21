import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { HomePage } from "./pages/HomePage";
import { DiaryPage } from "./pages/DiaryPage";
import { InterestsPage } from "./pages/InterestsPage";
import { LoginPage } from "./pages/LoginPage";
import { FitnessPage } from "./pages/FitnessPage";
import { WritePage } from "./pages/WritePage";
import { GymPage } from "./pages/GymPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "interests", Component: InterestsPage },
      { path: "login", Component: LoginPage },
      { path: "fitness", Component: FitnessPage },
      { path: "gym", Component: GymPage },
      { path: "diary", Component: DiaryPage },
      { path: "diary/write", Component: WritePage },
      { path: "write", element: <Navigate to="/diary/write" replace /> },
      { path: "album", element: <Navigate to="/fitness" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
