interface AlgorithmsModalProps {
  onClose: () => void
}

const ALGORITHMS = [
  {
    mode: 'Compress',
    name: 'Pillow — JPEG / WebP / PNG encoder',
    color: '#f59e0b',
    description:
      'Lossy compression based on DCT (Discrete Cosine Transform) for JPEG and WebP. The quality slider controls the quantisation table: lower values discard more high-frequency coefficients, reducing file size at the cost of detail. PNG uses DEFLATE (lossless). WebP combines predictive coding with entropy coding for better ratios than JPEG at the same perceptual quality.',
    details: ['DCT quantisation (JPEG / WebP)', 'DEFLATE lossless compression (PNG)', 'EXIF metadata strip / preserve', 'Chroma subsampling 4:2:0'],
  },
  {
    mode: 'Enhance',
    name: 'Real-ESRGAN — AI Super-Resolution',
    color: '#818cf8',
    description:
      'Convolutional neural network trained with a "real-world degradation" pipeline. It upscales images by 1×, 2×, or 4× by learning to hallucinate plausible high-frequency detail from low-resolution inputs. The generator is a Residual-in-Residual Dense Block (RRDB) network; the discriminator uses U-Net architecture with spectral normalisation to stabilise GAN training.',
    details: ['RRDB generator (23 residual blocks)', 'U-Net discriminator with spectral norm', 'Perceptual loss + GAN loss', 'Tile-based inference for large images'],
  },
  {
    mode: 'Resize',
    name: 'Lanczos — Sinc resampling',
    color: '#34d399',
    description:
      'High-quality downsampling and upsampling filter based on a windowed sinc function (Lanczos window, a = 3). It preserves sharpness better than bilinear or bicubic resampling by using a wider kernel that reconstructs the signal more faithfully according to the Nyquist–Shannon sampling theorem. Ideal for photographs and graphics where edge sharpness matters.',
    details: ['Windowed sinc kernel (a = 3)', 'Anti-aliasing on downscale', 'Sub-pixel accuracy', 'Aspect ratio lock option'],
  },
]

export function AlgorithmsModal({ onClose }: AlgorithmsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-[#111827] border border-[#1f2937] rounded-2xl w-full max-w-2xl mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2937]">
          <h2 className="text-sm font-bold text-[#e5e7eb] uppercase tracking-widest">Algorithms</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#6b7280] hover:text-[#e5e7eb] hover:bg-[#1f2937] transition-colors text-base"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {ALGORITHMS.map(alg => (
            <div key={alg.mode} className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: `${alg.color}22`, color: alg.color, border: `1px solid ${alg.color}44` }}
                >
                  {alg.mode}
                </span>
                <span className="text-sm font-semibold text-[#e5e7eb]">{alg.name}</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">{alg.description}</p>
              <ul className="flex flex-wrap gap-2">
                {alg.details.map(d => (
                  <li key={d} className="text-xs px-2 py-0.5 bg-[#111827] border border-[#374151] rounded-md text-[#6b7280]">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
