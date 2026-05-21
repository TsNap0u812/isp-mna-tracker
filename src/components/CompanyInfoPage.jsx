import { Building2 } from 'lucide-react'

export default function CompanyInfoPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-12">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 mb-5">
          <Building2 className="h-8 w-8 text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Company Info</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Company profiles and PE firm details coming soon.
        </p>
      </div>
    </div>
  )
}
