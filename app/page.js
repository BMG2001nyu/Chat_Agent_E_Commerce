import ChatWindow from '../components/ChatWindow';

export default function Home() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-logo">
            <span className="logo-part">Part</span>
            <span className="logo-select">Select</span>
          </div>
          <div className="header-title">Parts Assistant</div>
          <div className="header-scope">Refrigerators &amp; Dishwashers</div>
        </div>
      </header>
      <main className="app-main">
        <ChatWindow />
      </main>
    </div>
  );
}
