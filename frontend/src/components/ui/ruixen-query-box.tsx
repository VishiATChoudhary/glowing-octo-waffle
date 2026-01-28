"use client";

import { Mic, SendHorizonal, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface RuixenQueryBoxProps {
  onSend?: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function RuixenQueryBox({
  onSend,
  placeholder = "Ask anything...",
  disabled = false
}: RuixenQueryBoxProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 220,
  });

  const [inputValue, setInputValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = () => {
    if (!inputValue.trim() || disabled) return;
    console.log("Submitted:", inputValue);
    onSend?.(inputValue);
    setInputValue("");
    adjustHeight(true);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    console.log("Uploaded files:", files);
  };

  return (
    <div className="w-full px-4 py-6">
      <div className="relative w-full rounded-2xl border border-yellow-200 shadow-sm overflow-hidden" style={{ backgroundColor: 'white' }}>
        {/* Soft Pastel Yellow Gradient Background - matching title card */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 blur-3xl">
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-40"
              style={{
                background: '#FDE047',
                top: '-50%',
                left: '5%',
              }}
            />
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-40"
              style={{
                background: '#FBBF24',
                top: '-60%',
                left: '40%',
              }}
            />
            <div
              className="absolute w-[700px] h-[700px] rounded-full opacity-50"
              style={{
                background: '#F59E0B',
                top: '-70%',
                right: '-10%',
              }}
            />
          </div>
        </div>

        <Textarea
          id="ai-textarea"
          ref={textareaRef}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "relative z-10 w-full resize-none border-none bg-transparent",
            "text-base text-zinc-800 placeholder:text-zinc-600",
            "px-5 py-4 pr-24 rounded-2xl leading-[1.4]",
            "transition-all focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {/* Icon Buttons */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
          <button
            type="button"
            className="p-2 rounded-full bg-white/90 hover:bg-white text-zinc-700 transition-colors shadow-sm"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* File Upload Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-full bg-white/90 hover:bg-white text-zinc-700 transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-4">
              <p className="text-sm mb-2">Upload files:</p>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e.target.files)}
                className="w-full border border-gray-300 rounded p-1"
              />
              <Button
                className="mt-2 w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Files
              </Button>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || disabled}
            className={cn(
              "p-2 rounded-full transition-colors shadow-sm",
              inputValue.trim() && !disabled
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-white/60 text-gray-400 cursor-not-allowed"
            )}
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
