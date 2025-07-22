import "./App.css";

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

function App() {
  

  return (
    <div className="app">
      <h1>Hello World</h1>
    </div>
  );
}

export default function AppWithProvider() {
  return (
      <App />
  );
}
