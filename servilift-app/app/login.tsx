import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';

import { Icon } from '@/componentes/Comunes';
import { API_URL } from '@/config';
import { useSesion } from '@/sesion/SesionContext';
import { Colores } from '@/tema';

export default function Login() {
  const { usuario, entrar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [ocultar, setOcultar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (usuario) return <Redirect href="/" />;

  const ingresar = async () => {
    if (!correo.trim() || !clave) {
      setError('Ingrese correo y contraseña');
      return;
    }
    setEnviando(true);
    setError(null);
    const e = await entrar(correo, clave);
    setEnviando(false);
    setError(e);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colores.navy }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Card style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }}>
          <Card.Content style={{ padding: 16, gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <Icon nombre="elevator-passenger-outline" tam={56} color={Colores.acento} />
              <Text style={{ fontSize: 28, fontWeight: '800', color: Colores.navy }}>ServiLift</Text>
              <Text style={{ color: Colores.gris, textAlign: 'center' }}>Certificación de ascensores NTC 5926</Text>
            </View>
            <TextInput
              mode="outlined"
              label="Correo"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              left={<TextInput.Icon icon="email-outline" />}
            />
            <TextInput
              mode="outlined"
              label="Contraseña"
              value={clave}
              onChangeText={setClave}
              secureTextEntry={ocultar}
              onSubmitEditing={ingresar}
              left={<TextInput.Icon icon="lock-outline" />}
              right={<TextInput.Icon icon={ocultar ? 'eye' : 'eye-off'} onPress={() => setOcultar(!ocultar)} />}
            />
            {error && <Text style={{ color: Colores.error }}>{error}</Text>}
            <Button mode="contained" onPress={ingresar} loading={enviando} disabled={enviando} contentStyle={{ height: 46 }}>
              Ingresar
            </Button>
            <Text style={{ textAlign: 'center', fontSize: 11, color: Colores.gris }}>Servidor: {API_URL}</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
