function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent)]" />
    </div>
  );
}

export default Spinner;
