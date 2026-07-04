function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

export default Campo;
