import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Query from "./pages/Query";
import Settings from "./pages/Settings";
import ApiKeys from "./pages/ApiKeys";
import PaperSources from "./pages/PaperSources";
import Prompts from "./pages/Prompts";
import Whitelist from "./pages/Whitelist";
import Graph from "./pages/Graph";
import SearchPapers from "./pages/SearchPapers";
import Researchers from "./pages/Researchers";
import Pipeline from "./pages/Pipeline";
import Papers from "./pages/Papers";
import Email from "./pages/Email";
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TotalRevenue from "./pages/TotalRevenue";
import FastestRisingTopics from "./pages/FastestRisingTopics";
import NotFound from "./pages/NotFound";
import { SearchProvider } from "./contexts/SearchContext";
import { QueryProvider } from "./contexts/QueryContext";
import { GraphProvider } from "./contexts/GraphContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ResearchersProvider } from "./contexts/ResearchersContext";
import { PapersProvider } from "./contexts/PapersContext";
import { PipelineProvider } from "./contexts/PipelineContext";
import { GmailProvider } from "./contexts/GmailContext";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <GmailProvider>
              <SearchProvider>
                <QueryProvider>
                  <GraphProvider>
                    <ResearchersProvider>
                      <PapersProvider>
                        <PipelineProvider>
                          <Routes>
                            {/* Public routes */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/forgot-password" element={<ForgotPassword />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />

                            {/* Protected routes */}
                            <Route path="/" element={
                              <ProtectedRoute>
                                <Layout><Dashboard /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/query" element={
                              <ProtectedRoute>
                                <Layout><Query /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/search" element={
                              <ProtectedRoute>
                                <Layout><SearchPapers /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/researchers" element={
                              <ProtectedRoute>
                                <Layout><Researchers /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/papers" element={
                              <ProtectedRoute>
                                <Layout><Papers /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/pipeline" element={
                              <ProtectedRoute>
                                <Layout><Pipeline /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/settings" element={
                              <ProtectedRoute>
                                <Layout><Settings /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/settings/api-keys" element={
                              <ProtectedRoute>
                                <Layout><ApiKeys /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/settings/paper-sources" element={
                              <ProtectedRoute>
                                <Layout><PaperSources /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/settings/prompts" element={
                              <ProtectedRoute>
                                <Layout><Prompts /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/settings/whitelist" element={
                              <ProtectedRoute>
                                <Layout><Whitelist /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/graph" element={
                              <ProtectedRoute>
                                <Layout><Graph /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/email" element={
                              <ProtectedRoute>
                                <Layout><Email /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/total-revenue" element={
                              <ProtectedRoute>
                                <Layout><TotalRevenue /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="/fastest-rising-topics" element={
                              <ProtectedRoute>
                                <Layout><FastestRisingTopics /></Layout>
                              </ProtectedRoute>
                            } />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </PipelineProvider>
                      </PapersProvider>
                    </ResearchersProvider>
                  </GraphProvider>
                </QueryProvider>
              </SearchProvider>
            </GmailProvider>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
