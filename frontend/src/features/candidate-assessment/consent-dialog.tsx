"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Check, Video, Mic, MonitorUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const permissions: Array<{ key: PermissionType; label: string; icon: JSX.Element; description: string }> = [
  {
    key: "camera",
    label: "Webcam",
    icon: <Video className="h-4 w-4" />,
    description: "We capture periodic snapshots to verify you remain in view of the camera.",
  },
  {
    key: "microphone",
    label: "Microphone",
    icon: <Mic className="h-4 w-4" />,
    description: "Audio helps the recruiting team investigate suspicious noises.",
  },
  {
    key: "screen",
    label: "Screen",
    icon: <MonitorUp className="h-4 w-4" />,
    description: "Full-screen sharing confirms you remain in the assessment environment.",
  },
]

type PermissionType = "camera" | "microphone" | "screen"

type Status = "pending" | "granted" | "denied"

export interface ProctoringConsentDialogProps {
  open: boolean
  onContinue: () => void
  onCancel: () => void
  onStatusChange?: (status: Partial<Record<PermissionType, Status>>) => void
}

export function ProctoringConsentDialog({ open, onContinue, onCancel }: ProctoringConsentDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [status, setStatus] = useState<Record<PermissionType, Status>>({
    camera: "pending",
    microphone: "pending",
    screen: "pending",
  })
  const [requesting, setRequesting] = useState(false)

  const audioVideoGranted = status.camera === "granted" && status.microphone === "granted"
  // Screen share will be requested by the recording hook, not here (browsers don't remember screen permission)
  const screenAcknowledged = status.screen === "granted"
  const allGranted = audioVideoGranted && screenAcknowledged

  const requestPermissions = async () => {
    try {
      console.log('[ConsentDialog] Requesting camera & microphone permissions...')
      setRequesting(true)

      // Request webcam and microphone to verify permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      console.log('[ConsentDialog] ✅ Camera & microphone permissions granted:', {
        tracks: stream.getTracks().length,
        videoTrack: stream.getVideoTracks()[0]?.label,
        audioTrack: stream.getAudioTracks()[0]?.label
      })

      // Stop tracks after a short delay to prevent race condition
      // The recording hook needs time to request and access the permission
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop())
        console.log('[ConsentDialog] Stopped test tracks after delay')
      }, 500)

      const newStatus = { camera: "granted" as Status, microphone: "granted" as Status, screen: "pending" as Status }
      setStatus(newStatus)
    } catch (error) {
      console.error('[ConsentDialog] ❌ Camera & microphone permission denied:', error)
      const newStatus = { camera: "denied" as Status, microphone: "denied" as Status, screen: "denied" as Status }
      setStatus(newStatus)
    } finally {
      setRequesting(false)
    }
  }

  // Screen share is NOT requested here - browsers show the picker every time
  // The recording hook will request it when actually starting to record
  const acknowledgeScreenShare = () => {
    console.log('[ConsentDialog] User acknowledged screen share requirement')
    const newStatus = { ...status, screen: "granted" as Status }
    setStatus(newStatus)
  }

  const handleContinue = () => {
    console.log('[ConsentDialog] User clicked Continue button, all permissions granted')
    // Just signal that permissions were verified
    onContinue()
  }

  return (
    <Dialog open={open}>
      <DialogContent
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Proctoring consent required</DialogTitle>
          <DialogDescription>
            To maintain assessment integrity, we securely capture webcam video and microphone audio during your session.
            Recordings are encrypted and only accessible to authorized reviewers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {permissions.map((item) => (
            <div key={item.key} className="flex items-start gap-3 rounded-md border border-border bg-muted/60 p-3 text-sm">
              <div className="mt-1 text-primary">{item.icon}</div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {item.label}{" "}
                  {status[item.key] === "granted" ? <Check className="ml-1 inline h-4 w-4 text-emerald-500" /> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.key === "screen"
                    ? "You'll be prompted to share your screen after starting the assessment."
                    : item.description}
                </p>
                {status[item.key] === "denied" && item.key !== "screen" ? (
                  <p className="text-xs text-destructive">We couldn't access your {item.label.toLowerCase()}. Update browser permissions and try again.</p>
                ) : null}
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <AlertTriangle className="mt-[2px] h-4 w-4" />
            <p>
              Only proceed if you agree to monitored webcam, microphone, and full-screen sharing. Choose a quiet room with stable lighting and close unrelated tabs before
              starting.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="consent-checkbox"
              checked={acknowledged}
              onCheckedChange={(state) => setAcknowledged(state === true)}
            />
            <Label htmlFor="consent-checkbox" className="text-muted-foreground">
              I understand and agree to monitored webcam, microphone, and full-screen sharing for this assessment.
            </Label>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={requestPermissions} disabled={requesting || audioVideoGranted} className="w-full sm:w-auto">
            {requesting ? "Requesting…" : audioVideoGranted ? "Camera & Mic Granted ✓" : "Grant Camera & Mic"}
          </Button>
          <Button onClick={acknowledgeScreenShare} disabled={!audioVideoGranted || screenAcknowledged} className="w-full sm:w-auto" variant="secondary">
            {screenAcknowledged ? "Screen Share Acknowledged ✓" : "Acknowledge Screen Share"}
          </Button>
          <Button onClick={handleContinue} disabled={!acknowledged || !allGranted} className="w-full sm:w-auto">
            Continue (Screen share will be requested)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
