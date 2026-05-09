import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "./index";
import { ErrorState } from "./States";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="workspace-stack">
          <Card title={this.props.fallbackTitle || "Application Error"}>
            <ErrorState 
              title="Something went wrong" 
              description={this.state.error?.message || "An unexpected error occurred while rendering this component."}
              action={
                <button 
                  className="btn-primary" 
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </button>
              }
            />
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
