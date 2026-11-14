/* ==========================================================================
   UZU UNION BANK — ISO 20022 Message Builder
   Generates pacs.008.001.10 XML payment instruction messages.
   ========================================================================== */

export interface Iso20022PaymentInstruction {
  messageId: string;
  creationDateTime: string;
  numberOfTransactions: number;
  initiatingParty: {
    name: string;
    id: string;
  };
  paymentInstructions: Array<{
    instructionId: string;
    endToEndId: string;
    amount: number;
    currency: string;
    chargeBearer: string;
    debtor: {
      name: string;
      accountIban: string;
      bankBic: string;
    };
    creditor: {
      name: string;
      accountIban: string;
      bankBic: string;
    };
    remittanceInfo?: string;
  }>;
}

export function buildPacs008(payment: Iso20022PaymentInstruction): string {
  const pi = payment.paymentInstructions[0];
  const timestamp = payment.creationDateTime;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${payment.messageId}</MsgId>
      <CreDtTm>${timestamp}</CreDtTm>
      <NbOfTxs>${payment.numberOfTransactions}</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
      <InstgAgt>
        <FinInstnId>
          <BICFI>${pi.debtor.bankBic}</BICFI>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BICFI>${pi.creditor.bankBic}</BICFI>
        </FinInstnId>
      </InstdAgt>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>${pi.instructionId}</InstrId>
        <EndToEndId>${pi.endToEndId}</EndToEndId>
        <TxId>${payment.messageId}</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${pi.currency}">${pi.amount.toFixed(2)}</IntrBkSttlmAmt>
      <ChrgBr>${pi.chargeBearer}</ChrgBr>
      <Dbtr>
        <Nm>${pi.debtor.name}</Nm>
        <PstlAdr>
          <Ctry>US</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${pi.debtor.accountIban}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BICFI>${pi.debtor.bankBic}</BICFI>
        </FinInstnId>
      </DbtrAgt>
      <Cdtr>
        <Nm>${pi.creditor.name}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${pi.creditor.accountIban}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BICFI>${pi.creditor.bankBic}</BICFI>
        </FinInstnId>
      </CdtrAgt>
      <Purp>
        <Cd>TRPT</Cd>
      </Purp>
      ${pi.remittanceInfo ? `<RmtInf><Ustrd>${pi.remittanceInfo}</Ustrd></RmtInf>` : ''}
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;
}

export function generateMessageId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `UZU${ts}${rand}`;
}

export function generateEndToEndId(): string {
  return `E2E${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}