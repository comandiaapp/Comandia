import Sidebar from './Sidebar';

function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 pt-20 md:p-8">{children}</main>
    </div>
  );
}

export default Layout;
