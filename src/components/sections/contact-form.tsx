"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactSubmissionSchema, type ContactSubmissionDto } from "@/dto/contact-submission.dto";
import { INQUIRY_TYPES, type InquiryType } from "@/lib/constants/inquiry-types";

const inquiryLabels: Record<InquiryType, string> = {
  demo_request: "Request a demo",
  pricing: "Pricing",
  product_question: "Product question",
  partnership: "Partnership",
};
const inquiryItems = INQUIRY_TYPES.map((value) => ({ value, label: inquiryLabels[value] }));
const initialFields = {
  firstName: "", lastName: "", email: "", organizationName: "",
  inquiryType: "demo_request", message: "",
};
type Field = keyof typeof initialFields;
type FieldErrors = Partial<Record<Field, string[]>>;
type ApiBody = {
  error?: string;
  fieldErrors?: FieldErrors;
  data?: { inquiryId?: string };
};

export function ContactForm() {
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(false);
  const submission = useRef<ContactSubmissionDto | null>(null);
  const sending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  function updateField(field: Field, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
  }

  function focusInvalidField() {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  function startNewInquiry() {
    submission.current = null;
    setFields(initialFields);
    setErrors({});
    setNotice("");
    setRetryPending(false);
    setConflict(false);
    setSuccess(false);
    requestAnimationFrame(() => firstNameRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || conflict) return;
    setNotice("");
    setErrors({});

    const parsed = contactSubmissionSchema.safeParse(
      submission.current ?? { ...fields, submissionKey: crypto.randomUUID() },
    );
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      setNotice("Please check the highlighted fields.");
      focusInvalidField();
      return;
    }

    // Freeze the validated payload and key until the server confirms success.
    // A timeout may happen after persistence, so retries must use this payload.
    submission.current = parsed.data;
    sending.current = true;
    setBusy(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.json() as ApiBody;

      if (response.ok && typeof body.data?.inquiryId === "string") {
        submission.current = null;
        setFields(initialFields);
        setRetryPending(false);
        setSuccess(true);
        return;
      }
      if (response.status === 422) {
        submission.current = null;
        setRetryPending(false);
        setErrors(body.fieldErrors ?? {});
        setNotice("Please check your details and try again.");
        focusInvalidField();
        return;
      }
      if (response.status === 409) {
        setConflict(true);
        setNotice("This submission key belongs to a different inquiry. Start a new inquiry to continue.");
        return;
      }
      throw new Error("Submission was not confirmed.");
    } catch {
      setRetryPending(true);
      setNotice("We couldn’t confirm your submission. Your details are saved here—retry sending to check its status.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function errorFor(field: Field) {
    return errors[field]?.length ? (
      <p id={`contact-${field}-error`} className="text-sm text-destructive">{errors[field]?.[0]}</p>
    ) : null;
  }

  const disabled = busy || retryPending || conflict;
  const inquiryInvalid = Boolean(errors.inquiryType?.length);
  const textFields = [
    { name: "firstName", label: "First name", autoComplete: "given-name", maxLength: 100 },
    { name: "lastName", label: "Last name", autoComplete: "family-name", maxLength: 100 },
    { name: "email", label: "Email", autoComplete: "email", maxLength: 254 },
    { name: "organizationName", label: "Organization", autoComplete: "organization", maxLength: 200 },
  ] as const;

  if (success) {
    return (
      <div className="flex min-h-[400px] flex-col items-start justify-center gap-4 rounded-2xl border border-border bg-card p-6 sm:p-8" role="status">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent/30"><Check className="size-5" aria-hidden="true" /></span>
        <h3 ref={successRef} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">Your inquiry has been sent.</h3>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">Thanks for reaching out. We’ll be in touch using the email you provided.</p>
        <Button type="button" variant="outline" onClick={startNewInquiry}>Send another inquiry</Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label="Contact GptBots" aria-busy={busy} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      {notice && <p role="alert" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{notice}</p>}

      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="sr-only">Your contact details and inquiry</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {textFields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`contact-${field.name}`}>{field.label}</Label>
              <Input
                ref={field.name === "firstName" ? firstNameRef : undefined}
                id={`contact-${field.name}`} name={field.name}
                type={field.name === "email" ? "email" : "text"}
                autoComplete={field.autoComplete} maxLength={field.maxLength}
                required value={fields[field.name]}
                onChange={(event) => updateField(field.name, event.target.value)}
                aria-invalid={Boolean(errors[field.name]?.length)}
                aria-describedby={errors[field.name]?.length ? `contact-${field.name}-error` : undefined}
              />
              {errorFor(field.name)}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p id="contact-inquiryType-label" className="text-sm leading-none font-medium">What can we help you with?</p>
          <div role="radiogroup" aria-labelledby="contact-inquiryType-label" aria-describedby={inquiryInvalid ? "contact-inquiryType-error" : undefined} className="flex flex-wrap gap-2">
            {inquiryItems.map((item) => {
              const selected = fields.inquiryType === item.value;
              return (
                <label key={item.value} className={`inline-flex has-[:disabled]:cursor-not-allowed ${selected ? "" : "cursor-pointer"}`}>
                  <input
                    type="radio" name="inquiryType" value={item.value} required
                    checked={selected} onChange={() => updateField("inquiryType", item.value)}
                    aria-invalid={inquiryInvalid || undefined}
                    className="peer sr-only"
                  />
                  <span className={`inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-input hover:bg-muted"}`}>
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>
          {errorFor("inquiryType")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message">Tell us what you’d like to discuss</Label>
          <Textarea id="contact-message" name="message" required rows={4} maxLength={5_000} value={fields.message} onChange={(event) => updateField("message", event.target.value)} placeholder="Share your workflow, questions, or what you’d like to explore." aria-invalid={Boolean(errors.message?.length)} aria-describedby={errors.message?.length ? "contact-message-error" : undefined} className="min-h-36 resize-y" />
          {errorFor("message")}
        </div>
      </fieldset>

      <div className="mt-6">
        {conflict ? (
          <Button type="button" onClick={startNewInquiry} className="w-full">Start a new inquiry</Button>
        ) : (
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Sending…</> : <>{retryPending ? "Retry sending" : "Send inquiry"}<ArrowUpRight aria-hidden="true" /></>}
          </Button>
        )}
        <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">All fields are required.</p>
      </div>
    </form>
  );
}
