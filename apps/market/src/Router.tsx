import React from 'react';
import { Routes, Route } from 'react-router-dom';
import App from './App';
import { NodePage } from './pages/NodePage';
import { NodesPage } from './pages/NodesPage';

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/node/:nodeId" element={<NodePage />} />
      <Route path="/nodes" element={<NodesPage />} />
    </Routes>
  );
}
