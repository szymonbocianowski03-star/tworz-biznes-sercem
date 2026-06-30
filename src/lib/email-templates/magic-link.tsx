import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twój link do logowania w {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Twój link do logowania</Heading>
        <Text style={text}>
          Kliknij przycisk poniżej, aby zalogować się w {siteName}. Link wygaśnie
          wkrótce.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Zaloguj się
        </Button>
        <Text style={footer}>
          Jeśli to nie Ty prosiłeś o ten link, możesz zignorować tę wiadomość.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const button = {
  backgroundColor: '#d9711f',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '13px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#9aa0ab', margin: '28px 0 0' }
