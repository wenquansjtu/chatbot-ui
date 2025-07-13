import { ChatbotUIContext } from "@/context/context"
import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import useHotkey from "@/lib/hooks/use-hotkey"
import { IconAdjustmentsHorizontal } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef } from "react"
import { Button } from "../ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Label } from "../ui/label"
import { Slider } from "../ui/slider"

interface ChatSettingsProps {}

export const ChatSettings: FC<ChatSettingsProps> = ({}) => {
  useHotkey("i", () => handleClick())

  const { chatSettings, setChatSettings } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (buttonRef.current) {
      buttonRef.current.click()
    }
  }

  useEffect(() => {
    if (!chatSettings) return

    setChatSettings({
      ...chatSettings,
      temperature: Math.min(
        chatSettings.temperature,
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_TEMPERATURE || 1
      ),
      contextLength: Math.min(
        chatSettings.contextLength,
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_CONTEXT_LENGTH || 4096
      )
    })
  }, [chatSettings?.model])

  if (!chatSettings) return null

  return (
    <Popover>
      <PopoverTrigger>
        <Button
          ref={buttonRef}
          className="flex items-center space-x-2"
          variant="ghost"
        >
          <IconAdjustmentsHorizontal size={24} />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="bg-background border-input relative flex max-h-[calc(100vh-60px)] w-[300px] flex-col space-y-4 overflow-auto rounded-lg border-2 p-6 sm:w-[350px] dark:border-none"
        align="end"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Temperature: {chatSettings.temperature}</Label>
            <Slider
              value={[chatSettings.temperature]}
              onValueChange={value => {
                setChatSettings({ ...chatSettings, temperature: value[0] })
              }}
              max={
                CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_TEMPERATURE || 1
              }
              min={0}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Context Length: {chatSettings.contextLength}</Label>
            <Slider
              value={[chatSettings.contextLength]}
              onValueChange={value => {
                setChatSettings({ ...chatSettings, contextLength: value[0] })
              }}
              max={
                CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_CONTEXT_LENGTH ||
                4096
              }
              min={1000}
              step={100}
              className="w-full"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
