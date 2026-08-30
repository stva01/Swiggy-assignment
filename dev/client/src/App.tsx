/* Masala Ops routing: one shared workspace shell with focused views for roster, detail, tasks, and analytics. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppShell } from "./components/AppShell";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Dashboard from "./pages/Dashboard";
import CandidateDetail from "./pages/CandidateDetail";
import Tasks from "./pages/Tasks";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

function Router() {
  return <AppShell><Switch><Route path="/" component={Dashboard} /><Route path="/candidates/:id" component={CandidateDetail} /><Route path="/tasks" component={Tasks} /><Route path="/analytics" component={Analytics} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></AppShell>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><NotificationProvider><TooltipProvider><Toaster position="bottom-right" /><Router /></TooltipProvider></NotificationProvider></ThemeProvider></ErrorBoundary>;
}
