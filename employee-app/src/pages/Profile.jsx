import { useAuth } from '../context/AuthContext'
import { 
  User, Shield, CreditCard, Landmark, MapPin, 
  PhoneCall, Mail, Building2, Calendar, Briefcase 
} from 'lucide-react'

export default function Profile() {
  const { employee } = useAuth()
  const empDetails = employee?.employee

  if (!employee || !empDetails) return (
    <div className="p-10 text-center text-gray-500">
      Loading profile details...
      <p className="text-xs mt-2 text-gray-400">(If this takes too long, please re-login)</p>
    </div>
  )

  const Section = ({ title, icon: Icon, children, colorClass = "text-sky-600 bg-sky-50" }) => (
// ... (rest of the component using empDetails instead of employee)
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-gray-800 text-sm tracking-tight uppercase">{title}</h3>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  )

  const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5" />}
      <div>
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-700 font-semibold">{value || 'Not provided'}</p>
      </div>
    </div>
  )

  return (
    <div className="pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header Card */}
      <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }} className="rounded-3xl p-6 text-white shadow-xl shadow-sky-200/50 mb-6 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
             {empDetails.photo_url ? (
               <img src={empDetails.photo_url} alt={empDetails.name} className="w-full h-full rounded-2xl object-cover" />
             ) : (
               <User className="w-8 h-8 text-white" />
             ) }
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{empDetails.name}</h2>
            <p className="text-sky-100 text-xs font-medium opacity-90">{empDetails.designation || 'Team Member'}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
              {empDetails.emp_code}
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sky-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="space-y-4">
        {/* Employment Details */}
        <Section title="Employment" icon={Briefcase}>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Department" value={empDetails.department} icon={Building2} />
            <InfoRow label="Joining Date" value={empDetails.joining_date} icon={Calendar} />
          </div>
        </Section>

        {/* Identity Documents */}
        <Section title="Identity Documents" icon={Shield} colorClass="text-purple-600 bg-purple-50">
          <div className="grid grid-cols-1 gap-4">
            <InfoRow label="Aadhaar Card Number" value={empDetails.aadhaar_no} icon={CreditCard} />
            <InfoRow label="PAN Card Number" value={empDetails.pan_no} icon={CreditCard} />
          </div>
        </Section>

        {/* Bank Details */}
        <Section title="Bank Details" icon={Landmark} colorClass="text-green-600 bg-green-50">
          <InfoRow label="Bank Name" value={empDetails.bank_name} />
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Account Number" value={empDetails.account_no} />
            <InfoRow label="IFSC Code" value={empDetails.ifsc_code} />
          </div>
        </Section>

        {/* Address & Contact */}
        <Section title="Contact & Address" icon={MapPin} colorClass="text-orange-600 bg-orange-50">
          <div className="space-y-4">
            <InfoRow label="Personal Phone" value={empDetails.phone} icon={PhoneCall} />
            <InfoRow label="Email Address" value={empDetails.email} icon={Mail} />
            <InfoRow label="Current Address" value={empDetails.current_address} />
            <InfoRow label="Permanent Address" value={empDetails.permanent_address} />
          </div>
        </Section>

        {/* Emergency Contact */}
        <Section title="Emergency Contact" icon={PhoneCall} colorClass="text-red-600 bg-red-50">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Contact Name" value={empDetails.emergency_name} />
            <InfoRow label="Phone Number" value={empDetails.emergency_phone} />
          </div>
        </Section>
      </div>

      <div className="text-center mt-8 pb-6">
        <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">Member Since {new Date(empDetails.created_at).getFullYear()}</p>
      </div>
    </div>
  )
}
