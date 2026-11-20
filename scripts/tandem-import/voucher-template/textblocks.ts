/**
 * Textblocks seeded by `yarn tandem:seed` (ht-plugin Textblock entity, editable in the dashboard).
 * Voucher texts come from the old ext_shop locallang files (Resources/Private/Language/{de.,it.,}locallang.xlf),
 * order mail texts from tt_content on page 49 of the old site.
 *
 * Template fields with the same name as a textblock are filled per language by
 * VoucherByOrderService.getTextblockInputs (ht-plugin).
 */
type Texts = Record<"de" | "it" | "en", string>

const PHONE = "+39 379 280 6070"

export const VOUCHER_TEXTBLOCKS: Record<string, Texts> = {
    voucherHeadline: { de: "Gutschein", it: "Buono", en: "Voucher" },
    voucherSubline: { de: "für einen Tandemflug!", it: "per un volo in biposto!", en: "for a tandem flight!" },
    voucherQuote: {
        de: "Wenn du das Fliegen einmal erlebt hast, wirst du für immer\nauf Erden wandeln, mit deinen Augen himmelwärts gerichtet. Denn dort bist du\ngewesen und dort wird es dich immer wieder hinziehen.",
        // old text had "terraguardando" (typo) - fixed
        it: "Una volta che abbiate conosciuto il volo,\ncamminerete sulla terra guardando il cielo, perché là siete stati\ne là desidererete tornare.",
        en: "Once you have tasted flight you will forever\nwalk the earth with your eyes turned skywards, for there you have been\nand there you will always long to return.",
    },
    voucherQuoteAuthor: { de: "Leonardo da Vinci", it: "Leonardo da Vinci", en: "Leonardo da Vinci" },
    // message_contact_1 + phone + message_contact_2 (the old en.locallang.xlf had the German text, the English one is from locallang.xlf)
    voucherContactText: {
        de: `Kontaktiere uns per Telefon ${PHONE} um einen Termin zu vereinbaren.`,
        it: `Contattaci al telefono ${PHONE} per fissare un appuntamento.`,
        en: `Contact us by phone ${PHONE} to make an appointment.`,
    },
    // address_1 + "Martin <phone>" + address_2
    voucherAddressText: {
        de: `Tandem Flights Sarntal\nMartin ${PHONE}\ninfo@tandem.flights`,
        it: `Tandem Flights Sarntal\nMartin ${PHONE}\ninfo@tandem.flights`,
        en: `Tandem Flights Sarntal\nMartin ${PHONE}\ninfo@tandem.flights`,
    },
    voucherDatePrefixText: { de: "Gültig bis:", it: "Valido fino:", en: "Valid until:" },
    voucherDateFormat: { de: "DD.MM.YYYY", it: "DD.MM.YYYY", en: "DD.MM.YYYY" },
}

export const MAIL_TEXTBLOCKS: Record<string, Texts> = {
    // {name} = customer first + last name (order-confirmation.ts)
    orderInfoText: {
        de: "Hallo {name},\n\ndanke dir, dass du bei uns einen Flug gekauft hast.\nWir freuen uns mit dir zu fliegen,\ndein Team von Tandem Flights Sarntal",
        it: "Ciao {name},\n\ngrazie per aver acquistato un volo da noi.\nNon vediamo l'ora di volare con te,\nil tuo team di Tandem Flights Sarntal",
        en: "Hello {name},\n\nthank you for buying a flight from us.\nWe are looking forward to fly with you,\nyour team from Tandem Flights Sarntal",
    },
    // shown for PayPal / Stripe orders (order-confirmation.ts getVoucherText default)
    orderVoucherText: {
        de: `Im Anhang findest du deine Gutscheine als PDF. Jeder Gutschein ist ein Jahr gültig. Ruf uns unter ${PHONE} an, um einen Termin zu vereinbaren.`,
        it: `In allegato trovi i tuoi buoni in PDF. Ogni buono è valido un anno. Chiamaci al ${PHONE} per fissare un appuntamento.`,
        en: `Attached you will find your vouchers as PDF. Each voucher is valid for one year. Call us at ${PHONE} to make an appointment.`,
    },
    // postal address only: the mail footer already prints the shop name (SHOP_NAME) and phone | e-mail
    shopAddress: {
        de: `Reinswald 31/B, 39058 Sarntal, Italien`,
        it: `Reinswald 31/B, 39058 Sarentino (BZ), Italia`,
        en: `Reinswald 31/B, 39058 Sarntal, Italy`,
    },
}
