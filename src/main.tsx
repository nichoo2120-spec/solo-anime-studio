import React,{Component,type ErrorInfo,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './ui/App';
import './styles.css';
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}componentDidCatch(error:Error,info:ErrorInfo){console.error(error,info);}render(){return this.state.error?<div className="fatal"><h1>Studio couldn’t continue</h1><p>{this.state.error}</p><p>Your last successful local save remains available. Reload to recover it.</p><button onClick={()=>location.reload()}>Reload studio</button></div>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
