import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twój kod weryfikacyjny</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Potwierdź tożsamość</Heading>
        <Text style={text}>Użyj poniższego kodu, aby potwierdzić swoją tożsamość:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Kod wygaśnie wkrótce. Jeśli to nie Ty prosiłeś o weryfikację, możesz
          zignorować tę wiadomość.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  padding: '32px 0',
}
const container = {
  maxWidth: '480px',
  margin: '0 auto',
  backgroundColor: '#f6f3ec',
  border: '1px solid #e7e1d4',
  borderRadius: '16px',
  padding: '36px 32px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1b2230',
  letterSpacing: '-0.02em',
  margin: '0 0 18px',
}
const text = {
  fontSize: '15px',
  color: '#4a4f5a',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '30px',
  fontWeight: 'bold' as const,
  color: '#1b2230',
  letterSpacing: '6px',
  margin: '0 0 28px',
}
const footer = { fontSize: '12px', color: '#9aa0ab', margin: '28px 0 0' }
