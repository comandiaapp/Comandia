import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import Campo from './Campo';
import FortalezaPassword from './FortalezaPassword';

function CampoPassword({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  mostrarFortaleza = false,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Campo label={label}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={onChange}
          className="input pr-10"
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)]"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {mostrarFortaleza && <FortalezaPassword password={value} />}
    </Campo>
  );
}

export default CampoPassword;
