function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#a1a1aa]">{label}</span>
      {children}
    </label>
  );
}

export default Campo;
