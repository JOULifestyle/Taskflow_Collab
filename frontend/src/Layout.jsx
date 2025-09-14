function Layout({ children, dark }) {
  return (
    <div className={`min-h-screen flex flex-col relative ${dark ? "dark" : ""}`}>
      {/* Background image layer */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm"
        style={{
          backgroundImage: dark
            ? "url(https://images.pexels.com/photos/3299/postit-scrabble-to-do.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)"
            : "url(https://images.pexels.com/photos/4238511/pexels-photo-4238511.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)",
        }}
      />

      {/* Slight dark overlay for readability (optional) */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Foreground content */}
      <div className="relative z-10 flex-1">
        {children}
      </div>
    </div>
  );
}

export default Layout;
