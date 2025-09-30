const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-[calc(100vh_-_var(--header-height))] w-full">
      {children}
    </div>
  );
};

export default Layout;
