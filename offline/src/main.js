import { jsx as _jsx, jsxs as _jsxs } from "../jsx-runtime.js";
import React, { Component } from '../react.js';
import { createRoot } from '../react-dom-client.js';
import { App } from './ui/App.js';
class ErrorBoundary extends Component {
    state = { error: '' };
    static getDerivedStateFromError(error) { return { error: error.message }; }
    componentDidCatch(error, info) { console.error(error, info); }
    render() { return this.state.error ? _jsxs("div", { className: "fatal", children: [_jsx("h1", { children: "Studio couldn\u2019t continue" }), _jsx("p", { children: this.state.error }), _jsx("p", { children: "Your last successful local save remains available. Reload to recover it." }), _jsx("button", { onClick: () => location.reload(), children: "Reload studio" })] }) : this.props.children; }
}
createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(ErrorBoundary, { children: _jsx(App, {}) }) }));
