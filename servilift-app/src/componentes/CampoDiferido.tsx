// Campo de texto que guarda al dejar de escribir (o al salir del campo), sin guardar en cada letra.
// Si la pantalla se cierra mientras quedaba algo por guardar, lo guarda igual.
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native-paper';

export function CampoDiferido({ valor, onGuardar, espera = 700, ...props }: {
  valor: string;
  onGuardar: (texto: string) => void;
  espera?: number;
} & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText'>) {
  const [texto, setTexto] = useState(valor);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimo = useRef(valor);
  const pendiente = useRef<string | null>(null);
  const editando = useRef(false);
  const guardarRef = useRef(onGuardar);
  guardarRef.current = onGuardar;

  // Si el valor cambia desde afuera (sincronización) y no se está escribiendo, se actualiza
  useEffect(() => {
    if (!editando.current && pendiente.current === null && valor !== ultimo.current) {
      setTexto(valor);
      ultimo.current = valor;
    }
  }, [valor]);

  const guardar = () => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = null;
    const t = pendiente.current;
    pendiente.current = null;
    if (t !== null && t !== ultimo.current) {
      ultimo.current = t;
      guardarRef.current(t);
    }
  };

  useEffect(() => () => guardar(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TextInput
      mode="outlined"
      dense
      {...props}
      value={texto}
      onFocus={(e) => {
        editando.current = true;
        props.onFocus?.(e);
      }}
      onChangeText={(t) => {
        setTexto(t);
        pendiente.current = t;
        if (reloj.current) clearTimeout(reloj.current);
        reloj.current = setTimeout(guardar, espera);
      }}
      onBlur={(e) => {
        editando.current = false;
        guardar();
        props.onBlur?.(e);
      }}
    />
  );
}
