"use client"

import { Button } from "@/components/ui/button"
import { ethers } from "ethers"
import { FC, useState } from "react"

interface MetaMaskLoginProps {
  onLogin: (address: string, signature: string, message: string) => void
  onError: (error: string) => void
}

export const MetaMaskLogin: FC<MetaMaskLoginProps> = ({ onLogin, onError }) => {
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      onError("MetaMask is not installed. Please install MetaMask to continue.")
      return
    }

    setIsConnecting(true)

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      })

      if (accounts.length === 0) {
        onError("No accounts found. Please connect your MetaMask wallet.")
        return
      }

      const address = accounts[0]
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()

      // Create a message to sign
      const message = `Welcome to AgentNet! Please sign this message to verify your wallet ownership. Timestamp: ${Date.now()}`

      // Sign the message
      const signature = await signer.signMessage(message)

      // Call the parent component's login handler
      onLogin(address, signature, message)
    } catch (error: any) {
      console.error("MetaMask connection error:", error)

      if (error.code === 4001) {
        onError("Connection rejected by user.")
      } else if (error.code === -32002) {
        onError("Please check MetaMask and approve the connection.")
      } else {
        onError(`Connection failed: ${error.message}`)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={isConnecting}
      className="w-full bg-orange-500 text-white hover:bg-orange-600"
    >
      {isConnecting ? (
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-b-2 border-white"></div>
          Connecting...
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.49 4.27c-.34-.68-.85-1.19-1.53-1.53L12.73.5c-.68-.34-1.42-.34-2.1 0L3.04 2.74c-.68.34-1.19.85-1.53 1.53L.5 11.27c-.34.68-.34 1.42 0 2.1l1.24 7.63c.34.68.85 1.19 1.53 1.53l7.63 1.24c.68.34 1.42.34 2.1 0l7.63-1.24c.68-.34 1.19-.85 1.53-1.53l1.24-7.63c.34-.68.34-1.42 0-2.1L21.49 4.27zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
          </svg>
          Connect with MetaMask
        </div>
      )}
    </Button>
  )
}

declare global {
  interface Window {
    ethereum?: any
  }
}
