import { useState } from "react"
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenuItem, toast } from "@vendure/dashboard"
import { api } from "@/vdb/graphql/api.js"
import { CreditCardIcon, CopyIcon, EyeOffIcon } from "lucide-react"
import { useTranslations } from "../hooks/use-translations"

const REVEAL_SEPA_DETAILS = /* GraphQL */ `
    mutation RevealSepaDetails($paymentId: ID!) {
        revealSepaDetails(paymentId: $paymentId) {
            accountHolder
            iban
            bic
            bankName
            mandateReference
        }
    }
`

type SepaDetails = {
    accountHolder: string
    iban: string
    bic: string
    bankName: string
    mandateReference: string
}

type SepaPayment = {
    id: string
    metadata?: Record<string, any> | null
}

const findSepaPayments = (order: any): SepaPayment[] => {
    const payments = order?.payments ?? []
    return payments.filter((p: any) => p?.method === "sepa-direct-debit").map((p: any) => ({ id: p.id, metadata: p.metadata }))
}

const formatIban = (iban: string): string => iban.replace(/(.{4})/g, "$1 ").trim()

export const SepaRevealAction = ({ order }: { order: any }) => {
    const { t } = useTranslations()
    const sepaPayments = findSepaPayments(order)
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [details, setDetails] = useState<SepaDetails | null>(null)
    const [activePayment, setActivePayment] = useState<SepaPayment | null>(null)

    if (sepaPayments.length === 0) return null

    const copy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success(`${label} ${t("sepa.copied")}`)
        } catch {
            toast.error(`${label} ${t("sepa.copyFailed")}`)
        }
    }

    const openWith = async (payment: SepaPayment) => {
        setActivePayment(payment)
        setDetails(null)
        setOpen(true)
        setLoading(true)
        try {
            const result: any = await api.mutate(REVEAL_SEPA_DETAILS, { paymentId: payment.id })
            const data = result?.revealSepaDetails
            if (!data) {
                toast.error(t("sepa.noDataFound"))
                setOpen(false)
                return
            }
            setDetails(data as SepaDetails)
        } catch (err) {
            toast.error(t("sepa.loadFailed"), {
                description: err instanceof Error ? err.message : undefined,
            })
            setOpen(false)
        } finally {
            setLoading(false)
        }
    }

    const close = () => {
        setOpen(false)
        // wipe plaintext from memory once dialog closes
        setTimeout(() => {
            setDetails(null)
            setActivePayment(null)
        }, 300)
    }

    return (
        <>
            {sepaPayments.map((payment, idx) => (
                <DropdownMenuItem
                    key={payment.id}
                    variant="default"
                    closeOnClick={false}
                    onClick={() => openWith(payment)}
                >
                    <CreditCardIcon className="w-4 h-4" />
                    {t("sepa.menuLabel")}{sepaPayments.length > 1 ? ` (#${idx + 1})` : ""}
                </DropdownMenuItem>
            ))}
            <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t("sepa.title")}</DialogTitle>
                        <DialogDescription>
                            {t("sepa.description")}
                            {activePayment && <span className="block mt-1 text-xs opacity-70">{t("sepa.paymentId")}: {activePayment.id}</span>}
                        </DialogDescription>
                    </DialogHeader>

                    {loading && <div className="py-6 text-sm opacity-70">{t("sepa.loading")}</div>}

                    {!loading && details && (
                        <div className="space-y-3 py-2">
                            <SepaField label={t("sepa.accountHolder")} value={details.accountHolder} onCopy={copy} copyLabel={t("sepa.copy")} />
                            <SepaField label={t("sepa.iban")} value={formatIban(details.iban)} copyValue={details.iban} mono onCopy={copy} copyLabel={t("sepa.copy")} />
                            <SepaField label={t("sepa.bicSwift")} value={details.bic} mono onCopy={copy} copyLabel={t("sepa.copy")} />
                            <SepaField label={t("sepa.bank")} value={details.bankName} onCopy={copy} copyLabel={t("sepa.copy")} />
                            <SepaField label={t("sepa.mandateReference")} value={details.mandateReference} mono onCopy={copy} copyLabel={t("sepa.copy")} />
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={close}>
                            <EyeOffIcon className="w-4 h-4" />
                            {t("sepa.close")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

const SepaField = ({ label, value, copyValue, mono = false, onCopy, copyLabel }: { label: string; value: string; copyValue?: string; mono?: boolean; onCopy: (value: string, label: string) => void; copyLabel: string }) => (
    <div className="flex items-start justify-between gap-3 border-b last:border-b-0 pb-2 last:pb-0">
        <div className="flex-1 min-w-0">
            <div className="text-xs opacity-70">{label}</div>
            <div className={"text-sm break-all " + (mono ? "font-mono" : "")}>{value || "—"}</div>
        </div>
        {value && (
            <Button variant="ghost" size="sm" onClick={() => onCopy(copyValue ?? value, label)} title={`${copyLabel} ${label}`}>
                <CopyIcon className="w-4 h-4" />
            </Button>
        )}
    </div>
)
