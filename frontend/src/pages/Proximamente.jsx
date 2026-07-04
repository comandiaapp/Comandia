function Proximamente({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{titulo}</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Próximamente</p>
    </div>
  );
}

export default Proximamente;
