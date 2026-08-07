import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Strategies from './pages/Strategies';
import StrategyBuilder from './pages/StrategyBuilder';
import Backtest from './pages/Backtest';
import AIAssistant from './pages/AIAssistant';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="market" element={<Market />} />
        <Route path="strategies" element={<Strategies />} />
        <Route path="strategies/new" element={<StrategyBuilder />} />
        <Route path="strategies/:id/edit" element={<StrategyBuilder />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="ai" element={<AIAssistant />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}
