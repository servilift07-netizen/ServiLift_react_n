// Dónde se guarda la sesión en el celular: almacenamiento cifrado del sistema (Keychain / Keystore).
import * as SecureStore from 'expo-secure-store';

export async function leer(clave: string): Promise<string | null> {
  return SecureStore.getItemAsync(clave);
}

export async function guardar(clave: string, valor: string): Promise<void> {
  await SecureStore.setItemAsync(clave, valor);
}

export async function borrar(clave: string): Promise<void> {
  await SecureStore.deleteItemAsync(clave);
}
