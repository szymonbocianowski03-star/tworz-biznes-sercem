import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Potwierdź zmianę adresu e-mail w {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Potwierdź zmianę adresu e-mail</Heading>
        <Text style={text}>
          Poprosiłeś o zmianę adresu e-mail w {siteName} z{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          na{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Kliknij przycisk poniżej, aby potwierdzić tę zmianę:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Potwierdź zmianę e-maila
        </Button>
        <Text style={footer}>
          Jeśli to nie Ty prosiłeś o tę zmianę, niezwłocznie zabezpiecz swoje
          konto.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: '#d9711f', textDecoration: 'underline' }
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
