import React from 'react';
import { Routes, Route } from 'react-router-dom';
import App from './App';
import { NodePage } from './pages/NodePage';
import { RegisterPage } from './pages/RegisterPage';

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/node/:nodeId" element={<NodePage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  );
}