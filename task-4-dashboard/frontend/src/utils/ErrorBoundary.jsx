import React, { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0B0C10] px-6">
          <div className="max-w-xl border border-[#D4AF37]/40 bg-black/40 p-10 text-center backdrop-blur-md">
            <h2 className="font-headline-md text-headline-md uppercase tracking-widest text-[#D4AF37]">
              Winter Has Come. The Ravens Are Tired.
            </h2>
            <p className="mt-4 font-body-md text-sm uppercase tracking-[0.16em] text-[#c1c7ce]">
              {this.state.error?.message}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
