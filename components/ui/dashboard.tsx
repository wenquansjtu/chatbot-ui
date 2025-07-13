"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconChevronCompactRight } from "@tabler/icons-react"
import { FC, useState } from "react"
import { useSelectFileHandler } from "../chat/chat-hooks/use-select-file-handler"
import { CommandK } from "../utility/command-k"
import { Sidebar } from "../sidebar/sidebar"

export const SIDEBAR_WIDTH = 300

interface DashboardProps {
  children: React.ReactNode
}

export const Dashboard: FC<DashboardProps> = ({ children }) => {
  const { handleSelectDeviceFile } = useSelectFileHandler()

  const [isDragging, setIsDragging] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  const onFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    const files = event.dataTransfer.files
    const file = files[0]

    handleSelectDeviceFile(file)

    setIsDragging(false)
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div className="flex size-full">
      <CommandK />

      {/* 左侧边栏 - 只显示聊天记录 */}
      <div className="flex">
        <Sidebar contentType="chats" showSidebar={showSidebar} />
      </div>

      <div
        className="bg-muted/50 relative flex w-screen min-w-[90%] grow flex-col sm:min-w-fit"
        onDrop={onFileDrop}
        onDragOver={onDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {isDragging ? (
          <div className="flex h-full items-center justify-center bg-black/50 text-2xl text-white">
            drop file here
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
