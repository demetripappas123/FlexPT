'use client'

import { useState, useEffect } from 'react'
import { Package } from '@/supabase/fetches/fetchpackages'
import { upsertPackage, PackageFormData } from '@/supabase/upserts/upsertpackage'
import { fetchServices, Service } from '@/supabase/fetches/fetchservices'
import { upsertPackageService, PackageServiceFormData } from '@/supabase/upserts/upsertpackageservice'
import { deletePackageServicesByPackageId } from '@/supabase/upserts/upsertpackageservice'
import { fetchNutritionPrograms, NutritionProgram } from '@/supabase/fetches/fetchnutritionprograms'
import { fetchPrograms, Program } from '@/supabase/fetches/fetchprograms'
import { useAuth } from '@/context/authcontext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import { supabase } from '@/supabase/supabaseClient'

type PackageListProps = {
  packages: Package[]
  onPackagesUpdate: () => void
}

type BillingType = 'PIF' | 'recurring' | 'recurring_with_down_payment'

type ServiceSelection = {
  service_id: string
  service_name: string
  service_type: string
  is_consumable: boolean // Only sessions are consumable
  units_per_week?: number // For recurring
  units_total?: number // For PIF
  unit_cost?: number | null
  frequency_per_week?: number // For non-consumables like workouts/nutrition
  include_in_cost: 'included' | 'fixed_cost' | 'optional'
  fixed_cost?: number | null // For non-consumables with fixed cost
}

type PackageConstraints = {
  max_sessions_per_week?: number | null
  auto_create_tasks?: boolean
  trainer_notes?: string | null
}

export default function PackageList({ packages, onPackagesUpdate }: PackageListProps) {
  const { user } = useAuth()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)
  const [deletingPackage, setDeletingPackage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [billingType, setBillingType] = useState<BillingType>('PIF')
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([])
  const [offeringSessions, setOfferingSessions] = useState<boolean | null>(null)
  const [sessionServiceId, setSessionServiceId] = useState<string>('')
  const [sessionFrequency, setSessionFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [sessionUnits, setSessionUnits] = useState<number | null>(null)
  const [sessionUnitCost, setSessionUnitCost] = useState<number | null>(null)
  const [sessionsIncludedInCost, setSessionsIncludedInCost] = useState<boolean>(false)
  const [sessionServices, setSessionServices] = useState<Service[]>([])
  const [offeringWorkoutProgramming, setOfferingWorkoutProgramming] = useState<boolean | null>(null)
  const [workoutFrequency, setWorkoutFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [workoutUnits, setWorkoutUnits] = useState<number | null>(null)
  const [workoutProgrammingCost, setWorkoutProgrammingCost] = useState<number | null>(null)
  const [workoutProgrammingIncluded, setWorkoutProgrammingIncluded] = useState<boolean>(false)
  const [offeringNutritionProgramming, setOfferingNutritionProgramming] = useState<boolean | null>(null)
  const [nutritionType, setNutritionType] = useState<'full_meal' | 'macro_checkin'>('full_meal')
  const [nutritionFrequency, setNutritionFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [nutritionUnits, setNutritionUnits] = useState<number | null>(null)
  const [nutritionProgrammingCost, setNutritionProgrammingCost] = useState<number | null>(null)
  const [nutritionProgrammingIncluded, setNutritionProgrammingIncluded] = useState<boolean>(false)
  const [offeringCheckInForms, setOfferingCheckInForms] = useState<boolean | null>(null)
  const [checkInFormsFrequency, setCheckInFormsFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [checkInFormsUnits, setCheckInFormsUnits] = useState<number | null>(null)
  const [checkInFormsCost, setCheckInFormsCost] = useState<number | null>(null)
  const [checkInFormsIncluded, setCheckInFormsIncluded] = useState<boolean>(true)
  const [offeringDailyHabitForms, setOfferingDailyHabitForms] = useState<boolean | null>(null)
  const [dailyHabitFormsFrequency, setDailyHabitFormsFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [dailyHabitFormsUnits, setDailyHabitFormsUnits] = useState<number | null>(null)
  const [dailyHabitFormsCost, setDailyHabitFormsCost] = useState<number | null>(null)
  const [dailyHabitFormsIncluded, setDailyHabitFormsIncluded] = useState<boolean>(true)
  const [customCostPerCycle, setCustomCostPerCycle] = useState<number | null>(null)
  const [packageConstraints, setPackageConstraints] = useState<PackageConstraints>({
    max_sessions_per_week: null,
    auto_create_tasks: false,
    trainer_notes: null,
  })
  const [downPayment, setDownPayment] = useState<number>(0)
  const [pifSessionSpread, setPifSessionSpread] = useState<string>('') // How to spread out sessions for PIF
  const [pifSessionsPerPeriod, setPifSessionsPerPeriod] = useState<number | null>(null) // Sessions per week/month for PIF
  const [pifSessionPeriod, setPifSessionPeriod] = useState<'weekly' | 'monthly'>('weekly') // Weekly or monthly for PIF sessions
  const [durationUnit, setDurationUnit] = useState<'weeks' | 'months'>('weeks') // Duration input unit
  const [durationValue, setDurationValue] = useState<number>(0) // Store the original input value before conversion
  const [formData, setFormData] = useState<PackageFormData>({
    name: '',
    description: null,
    cycle_length_weeks: 0,
    package_length_weeks: 0,
    default_cost_per_cycle: 0,
    is_active: true,
    notes: null,
  })

  // Fetch services when step 2 is reached
  useEffect(() => {
    if (addDialogOpen && currentStep === 2) {
      loadServices()
    }
  }, [addDialogOpen, currentStep])

  // Filter session services (30/60 minutes) when services are loaded
  useEffect(() => {
    if (services.length > 0) {
      // Filter for session services - look for 30 or 60 minute sessions
      const sessionServicesList = services.filter(service => {
        const name = service.name?.toLowerCase() || ''
        const serviceType = service.service_type?.toLowerCase() || ''
        // Check if it's a session service and contains 30 or 60 minutes
        return (name.includes('session') || serviceType.includes('session')) &&
               (name.includes('30') || name.includes('60') || 
                name.includes('30 min') || name.includes('60 min') ||
                name.includes('30-minute') || name.includes('60-minute'))
      })
      setSessionServices(sessionServicesList)
      // Auto-select first session service if none selected
      if (sessionServicesList.length > 0 && !sessionServiceId) {
        setSessionServiceId(sessionServicesList[0].id)
      }
    }
  }, [services])

  // Recalculate total sessions for PIF when duration, frequency, or sessions per period changes
  useEffect(() => {
    if (billingType === 'PIF' && pifSessionsPerPeriod && pifSessionsPerPeriod > 0 && formData.package_length_weeks > 0) {
      let calculatedTotal: number
      
      if (sessionFrequency === 'weekly') {
        // Sessions per week × total weeks
        // Duration is stored in weeks, so use it directly
        calculatedTotal = pifSessionsPerPeriod * formData.package_length_weeks
      } else {
        // Sessions per month × total months
        // Use the original input value if duration was entered in months
        // Otherwise convert weeks to months (1 month = 4 weeks)
        const totalMonths = durationUnit === 'months' && durationValue > 0 
          ? durationValue 
          : (formData.package_length_weeks > 0 ? formData.package_length_weeks / 4 : 0)
        calculatedTotal = pifSessionsPerPeriod * totalMonths
      }
      
      if (calculatedTotal > 0) {
        setSessionUnits(Math.round(calculatedTotal))
      }
    }
  }, [billingType, pifSessionsPerPeriod, sessionFrequency, formData.package_length_weeks, durationUnit, durationValue])

  const loadServices = async () => {
    setLoadingServices(true)
    try {
      const servicesData = await fetchServices()
      setServices(servicesData)
    } catch (error) {
      console.error('Error loading services:', error)
      alert('Error loading services. Please try again.')
    } finally {
      setLoadingServices(false)
    }
  }

  const handleAddClick = () => {
    setFormData({
      name: '',
      description: null,
      cycle_length_weeks: 0,
      package_length_weeks: 0,
      default_cost_per_cycle: 0,
      is_active: true,
    })
    setBillingType('PIF')
    setIsIndefinite(false)
    setCurrentStep(1)
    setSelectedServices([])
    setOfferingSessions(null)
    setSessionServiceId('')
    setSessionFrequency('weekly')
    setSessionUnits(null)
    setSessionUnitCost(null)
    setSessionsIncludedInCost(false)
    setSessionServices([])
    setOfferingWorkoutProgramming(null)
    setWorkoutFrequency('weekly')
    setWorkoutUnits(null)
    setWorkoutProgrammingCost(null)
    setWorkoutProgrammingIncluded(false)
    setOfferingNutritionProgramming(null)
    setNutritionType('full_meal')
    setNutritionFrequency('weekly')
    setNutritionUnits(null)
    setNutritionProgrammingCost(null)
    setNutritionProgrammingIncluded(false)
    setOfferingCheckInForms(null)
    setCheckInFormsFrequency('weekly')
    setCheckInFormsUnits(null)
    setCheckInFormsCost(null)
    setCheckInFormsIncluded(true)
    setOfferingDailyHabitForms(null)
    setDailyHabitFormsFrequency('weekly')
    setDailyHabitFormsUnits(null)
    setDailyHabitFormsCost(null)
    setDailyHabitFormsIncluded(true)
    setCustomCostPerCycle(null)
    setPackageConstraints({
      max_sessions_per_week: null,
      auto_create_tasks: false,
      trainer_notes: null,
    })
    setDownPayment(0)
    setAddDialogOpen(true)
  }

  const handleToggleService = (service: Service) => {
    const isSelected = selectedServices.some(s => s.service_id === service.id)
    if (isSelected) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== service.id))
    } else {
      // Determine if service is consumable (only sessions are consumable)
      const isConsumable = service.service_type?.toLowerCase().includes('session') || 
                          service.name?.toLowerCase().includes('session')
      
      // Only allow client sessions
      if (isConsumable && !service.name?.toLowerCase().includes('client')) {
        alert('Only Client Sessions can be included in packages')
        return
      }

      setSelectedServices([...selectedServices, {
        service_id: service.id,
        service_name: service.name,
        service_type: service.service_type,
        is_consumable: isConsumable,
        include_in_cost: 'included',
        unit_cost: null,
        fixed_cost: null,
      }])
    }
  }

  const handleUpdateService = (serviceId: string, field: keyof ServiceSelection, value: any) => {
    setSelectedServices(selectedServices.map(s => 
      s.service_id === serviceId
        ? { ...s, [field]: value }
        : s
    ))
  }


  // Total steps: 8 for both PIF and recurring (steps 2 and 3 combined for PIF)
  const totalSteps = 8
  const progressPercentage = (currentStep / totalSteps) * 100

  const calculateCosts = () => {
    let totalCost = 0
    const cycleWeeks = formData.cycle_length_weeks || 1

    // Add session costs
    // Note: For now, cost calculation is simplified. Units per billing cycle will be calculated later from obligations
    if (offeringSessions === true && !sessionsIncludedInCost && sessionUnitCost && sessionUnits) {
      // Calculate approximate cost based on frequency and units
      // This is a placeholder - actual billing cycle calculation will be done later
      const obligationPeriodWeeks = sessionFrequency === 'weekly' ? 1 : 4
      const unitsPerWeek = sessionFrequency === 'weekly' ? sessionUnits : (sessionUnits / 4)
      const billingCycleWeeks = formData.cycle_length_weeks || 1
      const unitsPerBillingCycle = Math.round(unitsPerWeek * billingCycleWeeks)
      totalCost += unitsPerBillingCycle * sessionUnitCost
    }

    // Add workout programming costs
    if (offeringWorkoutProgramming === true && !workoutProgrammingIncluded && workoutProgrammingCost) {
      totalCost += workoutProgrammingCost
    }

    // Add nutrition programming costs
    if (offeringNutritionProgramming === true && !nutritionProgrammingIncluded && nutritionProgrammingCost) {
      totalCost += nutritionProgrammingCost
    }

    // Add check-in forms costs
    if (offeringCheckInForms === true && !checkInFormsIncluded && checkInFormsCost) {
      totalCost += checkInFormsCost
    }

    // Add daily habit forms costs
    if (offeringDailyHabitForms === true && !dailyHabitFormsIncluded && dailyHabitFormsCost) {
      totalCost += dailyHabitFormsCost
    }

    return totalCost
  }

  const handleNextStep = () => {
    // Validate step 1
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        alert('Please enter a package name')
        return
      }
      if (billingType !== 'PIF' && formData.cycle_length_weeks <= 0) {
        alert('Please enter a valid billing cycle duration')
        return
      }
      // Validate package length
      if (!isIndefinite && formData.package_length_weeks <= 0) {
        alert('Please enter a valid total duration')
        return
      }
      // For recurring packages, ensure duration is a multiple of cycle length
      if (billingType !== 'PIF' && !isIndefinite && formData.cycle_length_weeks > 0 && formData.package_length_weeks % formData.cycle_length_weeks !== 0) {
        alert(`Total duration must be a multiple of billing cycle duration (${formData.cycle_length_weeks} weeks)`)
        return
      }
    }
    // Step 2: Validate sessions (updated for PIF to include frequency)
    if (currentStep === 2) {
      if (offeringSessions === null) {
        alert('Please select whether you are offering sessions in this package')
        return
      }
      if (offeringSessions === true) {
        if (!sessionServiceId) {
          alert('Please select a session type')
          return
        }
        if (billingType === 'PIF') {
          // For PIF, validate sessions per period
          if (!pifSessionsPerPeriod || pifSessionsPerPeriod <= 0) {
            alert(`Please enter the number of sessions per ${sessionFrequency === 'weekly' ? 'week' : 'month'}`)
            return
          }
          if (!sessionUnits || sessionUnits <= 0) {
            alert('Total sessions could not be calculated. Please check your duration and sessions per period.')
            return
          }
        } else {
          // For recurring, validate frequency and units
          if (formData.cycle_length_weeks <= 0) {
            alert('Please set a billing cycle duration in step 1')
            return
          }
          if (!sessionUnits || sessionUnits <= 0) {
            alert('Please enter the number of units')
            return
          }
        }
        if (!sessionsIncludedInCost && (!sessionUnitCost || sessionUnitCost <= 0)) {
          alert('Please enter a unit cost or select "Include in total package cost"')
          return
        }
      }
    }
    // Step 3: Validate workout programming
    if (currentStep === 3) {
      // Workout programming validation
      if (offeringWorkoutProgramming === null) {
        alert('Please select whether you are offering workout programming in this package')
        return
      }
      if (offeringWorkoutProgramming === true) {
        if (!workoutUnits || workoutUnits <= 0) {
          alert('Please enter the number of units')
          return
        }
        if (!workoutProgrammingIncluded && (!workoutProgrammingCost || workoutProgrammingCost <= 0)) {
          alert('Please enter the cost of one billing cycle of programming or select "Include in total package cost"')
          return
        }
      }
    }
    // Step 4: Validate nutrition programming
    if (currentStep === 4) {
      if (offeringNutritionProgramming === null) {
        alert('Please select whether you are offering nutrition programming in this package')
        return
      }
      if (offeringNutritionProgramming === true) {
        if (!nutritionUnits || nutritionUnits <= 0) {
          alert('Please enter the number of units')
          return
        }
        if (!nutritionProgrammingIncluded && (!nutritionProgrammingCost || nutritionProgrammingCost <= 0)) {
          alert('Please enter the cost of one billing cycle of programming or select "Include in total package cost"')
          return
        }
      }
    }
    // Step 5: Validate check-in forms and daily habit forms
    if (currentStep === 5) {
      if (offeringCheckInForms === null) {
        alert('Please select whether you are offering check-in forms in this package')
        return
      }
      if (offeringCheckInForms === true) {
        if (!checkInFormsUnits || checkInFormsUnits <= 0) {
          alert('Please enter the number of units')
          return
        }
        if (!checkInFormsIncluded && (!checkInFormsCost || checkInFormsCost <= 0)) {
          alert('Please enter the cost per billing cycle or select "Include in total package cost"')
          return
        }
      }
      if (offeringDailyHabitForms === null) {
        alert('Please select whether you are offering daily habit forms in this package')
        return
      }
      if (offeringDailyHabitForms === true) {
        if (!dailyHabitFormsUnits || dailyHabitFormsUnits <= 0) {
          alert('Please enter the number of units')
          return
        }
        if (!dailyHabitFormsIncluded && (!dailyHabitFormsCost || dailyHabitFormsCost <= 0)) {
          alert('Please enter the cost per billing cycle or select "Include in total package cost"')
          return
        }
      }
    }
    // Step 6: Validate costs
    if (currentStep === 6) {
      const calculatedCost = calculateCosts()
      if (calculatedCost <= 0 && (offeringSessions === true || offeringWorkoutProgramming === true || offeringNutritionProgramming === true || offeringCheckInForms === true || offeringDailyHabitForms === true)) {
        if (!confirm('Total cost is $0.00. Continue anyway?')) {
          return
        }
      }
    }
    setCurrentStep(currentStep + 1)
  }

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleEditClick = (pkg: Package) => {
    setEditingPackage(pkg)
    setFormData({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      cycle_length_weeks: pkg.cycle_length_weeks,
      package_length_weeks: pkg.package_length_weeks,
      default_cost_per_cycle: pkg.default_cost_per_cycle,
      is_active: pkg.is_active,
      notes: pkg.notes || null,
    })
    setEditDialogOpen(true)
  }

  const handleDeleteClick = (pkg: Package) => {
    setEditingPackage(pkg)
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a package name')
      return
    }
    if (billingType !== 'PIF' && formData.cycle_length_weeks <= 0) {
      alert('Please enter a valid cycle length (in weeks)')
      return
    }
    if (!isIndefinite && formData.package_length_weeks <= 0) {
      alert('Please enter a valid package length (in weeks)')
      return
    }
    // For recurring services, use custom cost if set, otherwise use calculated cost
    const finalCost = (billingType === 'recurring' || billingType === 'recurring_with_down_payment') 
      ? (customCostPerCycle ?? calculateCosts())
      : calculateCosts()
    
    if (finalCost <= 0) {
      alert('Please enter a valid cost')
      return
    }

    setSaving(true)
    try {
      // First, upsert the package
      // Map UI state to database fields
      const packageData: PackageFormData = {
        ...formData,
        cycle_length_weeks: billingType === 'PIF' ? null : formData.cycle_length_weeks,
        default_cost_per_cycle: billingType === 'PIF' ? null : finalCost,
        notes: formData.notes || null,
        'until cancelled': billingType === 'PIF' ? false : isIndefinite,
        pif: billingType === 'PIF',
        pif_cost: billingType === 'PIF' ? finalCost : null,
      }
      // Log the package data before sending to help debug
      console.log('Creating package with data:', {
        ...packageData,
        cycle_length_weeks: packageData.cycle_length_weeks,
        package_length_weeks: packageData.package_length_weeks,
      })
      
      const savedPackage = await upsertPackage(packageData)

      // If editing, delete existing package_services first
      if (editingPackage?.id) {
        await deletePackageServicesByPackageId(editingPackage.id)
      }

      // Helper function to convert frequency and units to obligation cycle structure
      const convertToObligationCycle = (
        frequency: 'weekly' | 'monthly',
        units: number | null
      ): { unitsPerObligationCycle: number; obligationCycleLengthWeeks: number } => {
        // Weekly = 1 week, Monthly = 4 weeks
        const obligationCycleLengthWeeks = frequency === 'weekly' ? 1 : 4
        return {
          unitsPerObligationCycle: units || 0,
          obligationCycleLengthWeeks,
        }
      }

      // Create package_services entries for all configured services
      const packageServicesToCreate: PackageServiceFormData[] = []
      const isPIF = billingType === 'PIF'
      const billingCycleWeeks = formData.cycle_length_weeks || 1

      // Sessions
      if (offeringSessions === true && sessionServiceId && sessionUnits && sessionUnits > 0) {
        let unitsForObligation: number
        let frequencyForObligation: 'weekly' | 'monthly'
        
        if (billingType === 'PIF') {
          // For PIF, use the sessions per period and frequency
          if (pifSessionsPerPeriod && pifSessionsPerPeriod > 0) {
            unitsForObligation = pifSessionsPerPeriod
            frequencyForObligation = sessionFrequency
          } else if (formData.package_length_weeks > 0) {
            // Fallback: calculate sessions per week from total (only if package_length_weeks > 0)
            unitsForObligation = Math.round(sessionUnits / formData.package_length_weeks)
            frequencyForObligation = 'weekly'
          } else {
            // Skip if no valid data
            unitsForObligation = 0
            frequencyForObligation = 'weekly'
          }
        } else {
          // For recurring, use sessionUnits and sessionFrequency directly
          unitsForObligation = sessionUnits
          frequencyForObligation = sessionFrequency
        }
        
        if (unitsForObligation > 0) {
          const { unitsPerObligationCycle, obligationCycleLengthWeeks } = convertToObligationCycle(
            frequencyForObligation,
            unitsForObligation
          )
          
          // Ensure obligationCycleLengthWeeks is never 0 and unitsPerObligationCycle is valid
          if (obligationCycleLengthWeeks > 0 && unitsPerObligationCycle > 0 && !isNaN(unitsPerObligationCycle) && !isNaN(obligationCycleLengthWeeks)) {
            packageServicesToCreate.push({
              package_id: savedPackage.id,
              service_id: sessionServiceId,
              units_per_obligation_cycle: unitsPerObligationCycle,
              obligation_cycle_length_weeks: obligationCycleLengthWeeks,
              unit_cost: sessionsIncludedInCost ? null : (sessionUnitCost || null),
              is_included: sessionsIncludedInCost,
            })
          }
        }
      }

      // Workout Programming - find service by name/type
      if (offeringWorkoutProgramming === true) {
        const workoutService = services.find(s => 
          s.name?.toLowerCase().includes('workout') && 
          s.name?.toLowerCase().includes('programming')
        ) || services.find(s => s.service_type?.toLowerCase().includes('workout'))
        
        if (workoutService && workoutUnits && workoutUnits > 0) {
          const { unitsPerObligationCycle, obligationCycleLengthWeeks } = convertToObligationCycle(
            workoutFrequency,
            workoutUnits
          )
          if (obligationCycleLengthWeeks > 0 && unitsPerObligationCycle > 0) {
            packageServicesToCreate.push({
              package_id: savedPackage.id,
              service_id: workoutService.id,
              units_per_obligation_cycle: unitsPerObligationCycle,
              obligation_cycle_length_weeks: obligationCycleLengthWeeks,
              unit_cost: workoutProgrammingIncluded ? null : (workoutProgrammingCost || null),
              is_included: workoutProgrammingIncluded,
            })
          }
        }
      }

      // Nutrition Programming - find service by name/type based on nutrition type selection
      if (offeringNutritionProgramming === true) {
        let nutritionService
        if (nutritionType === 'macro_checkin') {
          // Find "macro only" service
          nutritionService = services.find(s => 
            s.name?.toLowerCase().includes('macro') && 
            (s.name?.toLowerCase().includes('only') || s.name?.toLowerCase().includes('check-in') || s.name?.toLowerCase().includes('checkin'))
          ) || services.find(s => 
            s.service_type?.toLowerCase().includes('macro') && 
            (s.service_type?.toLowerCase().includes('check-in') || s.service_type?.toLowerCase().includes('checkin'))
          )
        } else {
          // Find "programmed day of eating" service for full meal programming
          nutritionService = services.find(s => 
            (s.name?.toLowerCase().includes('programmed') && s.name?.toLowerCase().includes('eating')) ||
            (s.name?.toLowerCase().includes('programmed') && s.name?.toLowerCase().includes('day')) ||
            (s.name?.toLowerCase().includes('meal') && s.name?.toLowerCase().includes('programming'))
          ) || services.find(s => 
            s.service_type?.toLowerCase().includes('nutrition') && 
            s.service_type?.toLowerCase().includes('programming')
          )
        }
        
        if (nutritionService && nutritionUnits && nutritionUnits > 0) {
          const { unitsPerObligationCycle, obligationCycleLengthWeeks } = convertToObligationCycle(
            nutritionFrequency,
            nutritionUnits
          )
          if (obligationCycleLengthWeeks > 0 && unitsPerObligationCycle > 0) {
            packageServicesToCreate.push({
              package_id: savedPackage.id,
              service_id: nutritionService.id,
              units_per_obligation_cycle: unitsPerObligationCycle,
              obligation_cycle_length_weeks: obligationCycleLengthWeeks,
              unit_cost: nutritionProgrammingIncluded ? null : (nutritionProgrammingCost || null),
              is_included: nutritionProgrammingIncluded,
            })
          }
        }
      }

      // Check-in Forms - find "progress check form" service from services table
      if (offeringCheckInForms === true) {
        // First try to find "progress check form" specifically
        let checkInService = services.find(s => 
          s.name?.toLowerCase().includes('progress') && 
          (s.name?.toLowerCase().includes('check') || s.name?.toLowerCase().includes('form'))
        )
        
        // If not found, try services with ID starting with '0'
        if (!checkInService) {
          checkInService = services.find(s => s.id.startsWith('0'))
        }
        
        // Fallback to other check-in related services
        if (!checkInService) {
          checkInService = services.find(s => 
            (s.name?.toLowerCase().includes('check-in') || s.name?.toLowerCase().includes('checkin')) &&
            !s.name?.toLowerCase().includes('macro') // Exclude macro check-in services
          ) || services.find(s => 
            s.service_type?.toLowerCase().includes('check-in') || 
            s.service_type?.toLowerCase().includes('checkin') ||
            s.service_type?.toLowerCase().includes('progress')
          )
        }
        
        if (checkInService && checkInFormsUnits && checkInFormsUnits > 0) {
          const { unitsPerObligationCycle, obligationCycleLengthWeeks } = convertToObligationCycle(
            checkInFormsFrequency,
            checkInFormsUnits
          )
          if (obligationCycleLengthWeeks > 0 && unitsPerObligationCycle > 0) {
            packageServicesToCreate.push({
              package_id: savedPackage.id,
              service_id: checkInService.id,
              units_per_obligation_cycle: unitsPerObligationCycle,
              obligation_cycle_length_weeks: obligationCycleLengthWeeks,
              unit_cost: checkInFormsIncluded ? null : (checkInFormsCost || null),
              is_included: checkInFormsIncluded,
            })
          }
        }
      }

      // Daily Habit Forms - find service by name/type
      if (offeringDailyHabitForms === true) {
        const habitService = services.find(s => 
          s.name?.toLowerCase().includes('habit') || 
          s.name?.toLowerCase().includes('daily')
        ) || services.find(s => s.service_type?.toLowerCase().includes('habit'))
        
        if (habitService && dailyHabitFormsUnits && dailyHabitFormsUnits > 0) {
          const { unitsPerObligationCycle, obligationCycleLengthWeeks } = convertToObligationCycle(
            dailyHabitFormsFrequency,
            dailyHabitFormsUnits
          )
          if (obligationCycleLengthWeeks > 0 && unitsPerObligationCycle > 0) {
            packageServicesToCreate.push({
              package_id: savedPackage.id,
              service_id: habitService.id,
              units_per_obligation_cycle: unitsPerObligationCycle,
              obligation_cycle_length_weeks: obligationCycleLengthWeeks,
              unit_cost: dailyHabitFormsIncluded ? null : (dailyHabitFormsCost || null),
              is_included: dailyHabitFormsIncluded,
            })
          }
        }
      }

      // Create all package_services entries
      for (const packageService of packageServicesToCreate) {
        // Validate before sending to prevent division by zero
        if (!packageService.obligation_cycle_length_weeks || packageService.obligation_cycle_length_weeks <= 0) {
          console.error('Invalid obligation_cycle_length_weeks:', packageService)
          throw new Error(`Invalid obligation_cycle_length_weeks: ${packageService.obligation_cycle_length_weeks}. Must be greater than 0.`)
        }
        if (!packageService.units_per_obligation_cycle || packageService.units_per_obligation_cycle <= 0) {
          console.error('Invalid units_per_obligation_cycle:', packageService)
          throw new Error(`Invalid units_per_obligation_cycle: ${packageService.units_per_obligation_cycle}. Must be greater than 0.`)
        }
        
        await upsertPackageService(packageService)
      }

      setAddDialogOpen(false)
      setEditDialogOpen(false)
      setFormData({
        name: '',
        description: null,
        cycle_length_weeks: 0,
        package_length_weeks: 0,
        default_cost_per_cycle: 0,
        is_active: true,
        notes: null,
      })
      setCustomCostPerCycle(null)
      setEditingPackage(null)
      onPackagesUpdate()
    } catch (error) {
      console.error('Error saving package:', error)
      alert('Error saving package. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingPackage) return

    setDeletingPackage(true)
    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', editingPackage.id)

      if (error) throw error

      setDeleteDialogOpen(false)
      setEditingPackage(null)
      onPackagesUpdate()
    } catch (error) {
      console.error('Error deleting package:', error)
      alert('Error deleting package. Please try again.')
    } finally {
      setDeletingPackage(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleAddClick}
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Package
        </Button>
      </div>

      {packages.length === 0 ? (
        <div className="p-8 bg-card border border-border rounded-md text-center">
          <p className="text-muted-foreground">No packages yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-foreground px-4 py-3">Name</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Description</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Cycle length</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Package length</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Cost per cycle</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">PIF</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Until cancelled</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Active</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Notes</th>
                  <th className="text-right font-medium text-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{pkg.name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={pkg.description ?? undefined}>
                      {pkg.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {pkg.cycle_length_weeks != null ? `${pkg.cycle_length_weeks} wk` : pkg.pif ? 'N/A' : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">{pkg.package_length_weeks} wk</td>
                    <td className="px-4 py-3 text-foreground">
                      {pkg.default_cost_per_cycle != null ? `$${Number(pkg.default_cost_per_cycle).toFixed(2)}` : pkg.pif && pkg.pif_cost != null ? `$${Number(pkg.pif_cost).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">{pkg.pif ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-foreground">{pkg['until cancelled'] ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">
                      <span className={pkg.is_active ? 'text-green-500 font-medium' : 'text-muted-foreground'}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={pkg.notes ?? undefined}>
                      {pkg.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEditClick(pkg)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit package"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(pkg)}
                          className="text-destructive hover:text-destructive/80 cursor-pointer"
                          title="Delete package"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Package Dialog - Stepper */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open)
        if (!open) {
          setCurrentStep(1)
          setBillingType('PIF')
          setIsIndefinite(false)
          setSelectedServices([])
          setOfferingSessions(null)
          setSessionServiceId('')
          setSessionFrequency('weekly')
          setSessionUnits(null)
          setSessionUnitCost(null)
          setSessionsIncludedInCost(false)
          setSessionServices([])
          setOfferingWorkoutProgramming(null)
          setWorkoutFrequency('weekly')
          setWorkoutUnits(null)
          setWorkoutProgrammingCost(null)
          setWorkoutProgrammingIncluded(false)
          setOfferingNutritionProgramming(null)
          setNutritionType('full_meal')
          setNutritionFrequency('weekly')
          setNutritionUnits(null)
          setNutritionProgrammingCost(null)
          setNutritionProgrammingIncluded(false)
          setOfferingCheckInForms(null)
          setCheckInFormsFrequency('weekly')
          setCheckInFormsUnits(null)
          setCheckInFormsCost(null)
          setCheckInFormsIncluded(true)
          setOfferingDailyHabitForms(null)
          setDailyHabitFormsFrequency('weekly')
          setDailyHabitFormsUnits(null)
          setDailyHabitFormsCost(null)
          setDailyHabitFormsIncluded(true)
          setPifSessionSpread('')
          setPifSessionsPerPeriod(null)
          setPifSessionPeriod('weekly')
          setDurationUnit('weeks')
          setDurationValue(0)
          setCustomCostPerCycle(null)
          setPackageConstraints({
            max_sessions_per_week: null,
            auto_create_tasks: false,
            trainer_notes: null,
          })
          setDownPayment(0)
        }
      }}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add New Package</DialogTitle>
            <DialogDescription>Create a new training package</DialogDescription>
          </DialogHeader>
          
          {/* Progress Bar */}
          <div className="w-full mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className="space-y-4 py-4 min-h-[300px] overflow-y-auto flex-1">
            {currentStep === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Package Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Monthly Training Package"
                    className="bg-input text-foreground border-border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Description (optional)</label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                    placeholder="Package description..."
                    className="bg-input text-foreground border-border"
                    rows={3}
                  />
                </div>
                
                {/* Billing Type */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Billing Type</label>
                  <select
                    value={billingType === 'recurring_with_down_payment' ? 'recurring' : billingType}
                    onChange={(e) => {
                      const newBillingType = e.target.value as BillingType
                      setBillingType(newBillingType)
                      if (newBillingType === 'PIF') {
                        setFormData({ ...formData, cycle_length_weeks: 0 })
                      }
                    }}
                    className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="PIF">PIF</option>
                    <option value="recurring">Recurring</option>
                  </select>
                  {(billingType === 'recurring' || billingType === 'recurring_with_down_payment') && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ℹ️ Note: Any amount of down payments can be accepted for recurring packages when assigned to a client.
                    </p>
                  )}
                </div>

                {/* Billing Cycle Duration - Only show if not PIF */}
                {billingType !== 'PIF' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Billing Cycle Duration (weeks)</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.cycle_length_weeks || ''}
                      onChange={(e) => {
                        const cycleWeeks = parseInt(e.target.value) || 0
                        setFormData({ ...formData, cycle_length_weeks: cycleWeeks })
                        // Auto-adjust package length to be a multiple if it's not indefinite
                        if (!isIndefinite && formData.package_length_weeks > 0 && cycleWeeks > 0) {
                          const adjustedLength = Math.ceil(formData.package_length_weeks / cycleWeeks) * cycleWeeks
                          setFormData(prev => ({ ...prev, package_length_weeks: adjustedLength }))
                        }
                      }}
                      placeholder="Number of weeks per billing cycle"
                      className="bg-input text-foreground border-border"
                    />
                  </div>
                )}

                {/* Total Duration */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Total Duration</label>
                  <div className="space-y-2">
                    {(billingType === 'recurring' || billingType === 'recurring_with_down_payment') && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_indefinite"
                          checked={isIndefinite}
                          onChange={(e) => {
                            setIsIndefinite(e.target.checked)
                            if (e.target.checked) {
                              setFormData({ ...formData, package_length_weeks: 0 })
                            }
                          }}
                          className="w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="is_indefinite" className="text-sm text-foreground cursor-pointer">
                          Indefinite (ongoing)
                        </label>
                      </div>
                    )}
                    {!isIndefinite && (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={
                            durationUnit === 'weeks'
                              ? formData.package_length_weeks || ''
                              : formData.package_length_weeks ? Math.round(formData.package_length_weeks / 4) : ''
                          }
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0
                            setDurationValue(value) // Store original input value
                            let totalWeeks: number
                            if (durationUnit === 'weeks') {
                              totalWeeks = value
                            } else {
                              // Convert months to weeks (1 month = 4 weeks)
                              totalWeeks = value * 4
                            }
                            
                            if (billingType !== 'PIF' && formData.cycle_length_weeks > 0 && totalWeeks > 0) {
                              // Ensure it's a multiple of cycle length for recurring
                              // Only divide if cycle_length_weeks > 0 to prevent division by zero
                              const adjustedWeeks = formData.cycle_length_weeks > 0
                                ? Math.ceil(totalWeeks / formData.cycle_length_weeks) * formData.cycle_length_weeks
                                : totalWeeks
                              setFormData({ ...formData, package_length_weeks: adjustedWeeks })
                            } else {
                              setFormData({ ...formData, package_length_weeks: totalWeeks })
                            }
                            // Trigger recalculation of sessions for PIF
                          }}
                          placeholder={
                            billingType === 'PIF'
                              ? `Total package duration in ${durationUnit}`
                              : `Must be a multiple of ${formData.cycle_length_weeks || 'billing cycle'} weeks`
                          }
                          className="bg-input text-foreground border-border flex-1"
                        />
                        <select
                          value={durationUnit}
                          onChange={(e) => {
                            const newUnit = e.target.value as 'weeks' | 'months'
                            setDurationUnit(newUnit)
                            // Update durationValue when switching units
                            if (formData.package_length_weeks > 0) {
                              if (newUnit === 'months') {
                                setDurationValue(Math.round(formData.package_length_weeks / 4))
                              } else {
                                setDurationValue(formData.package_length_weeks)
                              }
                            }
                          }}
                          className="bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                    )}
                    {!isIndefinite && billingType !== 'PIF' && formData.cycle_length_weeks > 0 && formData.package_length_weeks > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formData.package_length_weeks % formData.cycle_length_weeks === 0
                          ? `✓ ${formData.package_length_weeks / formData.cycle_length_weeks} billing cycles`
                          : `⚠ Must be a multiple of ${formData.cycle_length_weeks} weeks`}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Sessions</h3>
                  <p className="text-sm text-muted-foreground mb-4">Will you add sessions to this package?</p>
                </div>

                {/* Yes/No Selection */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setOfferingSessions(true)
                      if (billingType === 'PIF' && !sessionUnits) {
                        setSessionUnits(1)
                      } else if (billingType !== 'PIF' && !sessionUnits) {
                        setSessionUnits(1)
                      }
                    }}
                    className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                      offeringSessions === true
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOfferingSessions(false)
                      setSessionUnits(null)
                      setSessionUnitCost(null)
                      setSessionsIncludedInCost(false)
                    }}
                    className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                      offeringSessions === false
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">No</span>
                  </button>
                </div>

                {/* Session Configuration (if Yes) */}
                {offeringSessions === true && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    {/* Session Type */}
                    <div>
                      <label className="block text-sm font-medium mb-1 text-foreground">Type of Session</label>
                      {loadingServices ? (
                        <p className="text-muted-foreground text-sm">Loading session types...</p>
                      ) : sessionServices.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No session services found. Please create 30 or 60 minute session services first.</p>
                      ) : (
                        <select
                          value={sessionServiceId}
                          onChange={(e) => setSessionServiceId(e.target.value)}
                          className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="">Select session type...</option>
                          {sessionServices.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Frequency and Units - Different UI for PIF vs Recurring */}
                    {billingType === 'PIF' ? (
                      <div className="space-y-4">
                        {/* Toggle between weekly and monthly */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSessionFrequency('weekly')
                              setPifSessionPeriod('weekly')
                            }}
                            className={`flex-1 p-3 border-2 rounded-md transition-colors ${
                              sessionFrequency === 'weekly'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background hover:bg-muted/50'
                            }`}
                          >
                            <span className="font-medium">Per Week</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionFrequency('monthly')
                              setPifSessionPeriod('monthly')
                            }}
                            className={`flex-1 p-3 border-2 rounded-md transition-colors ${
                              sessionFrequency === 'monthly'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background hover:bg-muted/50'
                            }`}
                          >
                            <span className="font-medium">Per Month</span>
                          </button>
                        </div>

                        {/* Sessions per period input */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">
                            Sessions per {sessionFrequency === 'weekly' ? 'Week' : 'Month'}
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={pifSessionsPerPeriod ?? ''}
                            onChange={(e) => {
                              const sessionsPerPeriod = e.target.value ? parseInt(e.target.value) : null
                              setPifSessionsPerPeriod(sessionsPerPeriod)
                              // Calculation will happen in useEffect
                            }}
                            placeholder={`e.g., ${sessionFrequency === 'weekly' ? '3' : '12'}`}
                            className="bg-input text-foreground border-border"
                          />
                        </div>

                        {/* Display calculated total sessions */}
                        {pifSessionsPerPeriod && formData.package_length_weeks > 0 && (
                          <div className="p-3 bg-muted/50 border border-border rounded-md">
                            <p className="text-sm text-foreground">
                              <span className="font-medium">Total Sessions: {sessionUnits || 0}</span>
                              <span className="text-muted-foreground ml-2">
                                {sessionFrequency === 'weekly' ? (
                                  <>
                                    ({pifSessionsPerPeriod} per week × {formData.package_length_weeks} {formData.package_length_weeks === 1 ? 'week' : 'weeks'})
                                  </>
                                ) : (
                                  <>
                                    ({pifSessionsPerPeriod} per month × {durationUnit === 'months' ? durationValue : Math.round(formData.package_length_weeks / 4)} {durationUnit === 'months' ? (durationValue === 1 ? 'month' : 'months') : (Math.round(formData.package_length_weeks / 4) === 1 ? 'month' : 'months')})
                                  </>
                                )}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">Frequency</label>
                          <select
                            value={sessionFrequency}
                            onChange={(e) => setSessionFrequency(e.target.value as 'weekly' | 'monthly')}
                            className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">
                            Units per {sessionFrequency === 'weekly' ? 'Week' : 'Month'}
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={sessionUnits ?? ''}
                            onChange={(e) => setSessionUnits(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="e.g., 2"
                            className="bg-input text-foreground border-border"
                          />
                        </div>
                      </div>
                    )}

                    {/* Unit Cost or Include in Total */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sessions_included_in_cost"
                          checked={sessionsIncludedInCost}
                          onChange={(e) => {
                            setSessionsIncludedInCost(e.target.checked)
                            if (e.target.checked) {
                              setSessionUnitCost(null)
                            }
                          }}
                          className="w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="sessions_included_in_cost" className="text-sm text-foreground cursor-pointer">
                          Include in total package cost (no unit cost)
                        </label>
                      </div>

                      {!sessionsIncludedInCost && (
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">Unit Cost ($)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={sessionUnitCost ?? ''}
                            onChange={(e) => setSessionUnitCost(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="0.00"
                            className="bg-input text-foreground border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Workout Programming */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Workout Programming</h3>
                  <p className="text-sm text-muted-foreground mb-4">Will you include workout programming in this package?</p>
                </div>

                {/* Yes/No Selection */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setOfferingWorkoutProgramming(true)
                      if (!workoutUnits) setWorkoutUnits(1)
                    }}
                    className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                      offeringWorkoutProgramming === true
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOfferingWorkoutProgramming(false)
                      setWorkoutUnits(null)
                      setWorkoutProgrammingCost(null)
                      setWorkoutProgrammingIncluded(false)
                    }}
                    className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                      offeringWorkoutProgramming === false
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">No</span>
                  </button>
                </div>

                {/* Workout Programming Configuration (if Yes) */}
                {offeringWorkoutProgramming === true && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    {/* Workout Frequency and Units */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-foreground">Frequency</label>
                        <select
                          value={workoutFrequency}
                          onChange={(e) => setWorkoutFrequency(e.target.value as 'weekly' | 'monthly')}
                          className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-foreground">
                          Units per {workoutFrequency === 'weekly' ? 'Week' : 'Month'}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={workoutUnits ?? ''}
                          onChange={(e) => setWorkoutUnits(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="e.g., 3"
                          className="bg-input text-foreground border-border"
                        />
                      </div>
                    </div>

                    {/* Cost or Include in Total */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="workout_programming_included"
                          checked={workoutProgrammingIncluded}
                          onChange={(e) => {
                            setWorkoutProgrammingIncluded(e.target.checked)
                            if (e.target.checked) {
                              setWorkoutProgrammingCost(null)
                            }
                          }}
                          className="w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="workout_programming_included" className="text-sm text-foreground cursor-pointer">
                          Include in total package cost (no additional cost)
                        </label>
                      </div>

                      {!workoutProgrammingIncluded && (
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">
                            Cost of One Billing Cycle of Programming ($)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={workoutProgrammingCost ?? ''}
                            onChange={(e) => setWorkoutProgrammingCost(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="0.00"
                            className="bg-input text-foreground border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Nutrition Programming */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Nutrition Programming</h3>
                  <p className="text-sm text-muted-foreground mb-4">Will you include nutrition programming in this package?</p>
                </div>

                {/* Yes/No Selection */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setOfferingNutritionProgramming(true)
                      if (!nutritionUnits) setNutritionUnits(1)
                    }}
                    className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                      offeringNutritionProgramming === true
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOfferingNutritionProgramming(false)
                      setNutritionUnits(null)
                      setNutritionProgrammingCost(null)
                      setNutritionProgrammingIncluded(false)
                    }}
                    className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                      offeringNutritionProgramming === false
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">No</span>
                  </button>
                </div>

                {/* Nutrition Programming Configuration (if Yes) */}
                {offeringNutritionProgramming === true && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    {/* Nutrition Type */}
                    <div>
                      <label className="block text-sm font-medium mb-1 text-foreground">Type of Nutrition Programming</label>
                      <select
                        value={nutritionType}
                        onChange={(e) => setNutritionType(e.target.value as 'full_meal' | 'macro_checkin')}
                        className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="full_meal">Full Meal Programming</option>
                        <option value="macro_checkin">Macro Check-in Only</option>
                      </select>
                    </div>

                    {/* Nutrition Frequency and Units */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-foreground">Frequency</label>
                        <select
                          value={nutritionFrequency}
                          onChange={(e) => setNutritionFrequency(e.target.value as 'weekly' | 'monthly')}
                          className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-foreground">
                          {nutritionType === 'full_meal' ? 'Days' : 'Days'} per {nutritionFrequency === 'weekly' ? 'Week' : 'Month'}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={nutritionUnits ?? ''}
                          onChange={(e) => setNutritionUnits(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="e.g., 5"
                          className="bg-input text-foreground border-border"
                        />
                      </div>
                    </div>

                    {/* Cost or Include in Total */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="nutrition_programming_included"
                          checked={nutritionProgrammingIncluded}
                          onChange={(e) => {
                            setNutritionProgrammingIncluded(e.target.checked)
                            if (e.target.checked) {
                              setNutritionProgrammingCost(null)
                            }
                          }}
                          className="w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="nutrition_programming_included" className="text-sm text-foreground cursor-pointer">
                          Include in total package cost (no additional cost)
                        </label>
                      </div>

                      {!nutritionProgrammingIncluded && (
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">
                            Cost of One Billing Cycle of Programming ($)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={nutritionProgrammingCost ?? ''}
                            onChange={(e) => setNutritionProgrammingCost(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="0.00"
                            className="bg-input text-foreground border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Check-in Forms & Daily Habit Forms */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Check-in Forms & Daily Habit Forms</h3>
                  <p className="text-sm text-muted-foreground mb-4">Configure check-in forms and daily habit forms for this package.</p>
                </div>

                {/* Check-in Forms Section */}
                <div className="space-y-4 pb-4 border-b border-border">
                  <div>
                    <h4 className="text-md font-medium text-foreground mb-2">Check-in Forms</h4>
                    <p className="text-sm text-muted-foreground mb-4">Will you include check-in forms in this package?</p>
                  </div>

                  {/* Yes/No Selection for Check-in Forms */}
                  <div className="flex gap-4">
                    <button
                      type="button"
                        onClick={() => {
                        setOfferingCheckInForms(true)
                        if (!checkInFormsUnits) setCheckInFormsUnits(1)
                      }}
                      className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                        offeringCheckInForms === true
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                    >
                      <span className="font-medium">Yes</span>
                    </button>
                    <button
                      type="button"
                        onClick={() => {
                        setOfferingCheckInForms(false)
                        setCheckInFormsUnits(null)
                        setCheckInFormsCost(null)
                        setCheckInFormsIncluded(true)
                      }}
                      className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                        offeringCheckInForms === false
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                    >
                      <span className="font-medium">No</span>
                    </button>
                  </div>

                  {/* Check-in Forms Configuration (if Yes) */}
                  {offeringCheckInForms === true && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      {/* Check-in Forms Frequency and Units */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">Frequency</label>
                          <select
                            value={checkInFormsFrequency}
                            onChange={(e) => setCheckInFormsFrequency(e.target.value as 'weekly' | 'monthly')}
                            className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">
                            Units per {checkInFormsFrequency === 'weekly' ? 'Week' : 'Month'}
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={checkInFormsUnits ?? ''}
                            onChange={(e) => setCheckInFormsUnits(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 1"
                            className="bg-input text-foreground border-border"
                          />
                        </div>
                      </div>

                      {/* Cost or Include in Total */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="check_in_forms_included"
                            checked={checkInFormsIncluded}
                            onChange={(e) => {
                              setCheckInFormsIncluded(e.target.checked)
                              if (e.target.checked) {
                                setCheckInFormsCost(null)
                              }
                            }}
                            className="w-4 h-4 rounded border-border"
                          />
                          <label htmlFor="check_in_forms_included" className="text-sm text-foreground cursor-pointer">
                            Include in total package cost (no additional cost)
                          </label>
                        </div>

                        {!checkInFormsIncluded && (
                          <div>
                            <label className="block text-sm font-medium mb-1 text-foreground">
                              Cost Per Billing Cycle ($)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={checkInFormsCost ?? ''}
                              onChange={(e) => setCheckInFormsCost(e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="0.00"
                              className="bg-input text-foreground border-border"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Habit Forms Section */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-md font-medium text-foreground mb-2">Daily Habit Forms</h4>
                    <p className="text-sm text-muted-foreground mb-4">Will you include daily habit forms in this package?</p>
                  </div>

                  {/* Yes/No Selection for Daily Habit Forms */}
                  <div className="flex gap-4">
                    <button
                      type="button"
                        onClick={() => {
                        setOfferingDailyHabitForms(true)
                        if (!dailyHabitFormsUnits) setDailyHabitFormsUnits(1)
                      }}
                      className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                        offeringDailyHabitForms === true
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                    >
                      <span className="font-medium">Yes</span>
                    </button>
                    <button
                      type="button"
                        onClick={() => {
                        setOfferingDailyHabitForms(false)
                        setDailyHabitFormsUnits(null)
                        setDailyHabitFormsCost(null)
                        setDailyHabitFormsIncluded(true)
                      }}
                      className={`flex-1 p-4 border-2 rounded-md transition-colors ${
                        offeringDailyHabitForms === false
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                    >
                      <span className="font-medium">No</span>
                    </button>
                  </div>

                  {/* Daily Habit Forms Configuration (if Yes) */}
                  {offeringDailyHabitForms === true && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      {/* Daily Habit Forms Frequency and Units */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">Frequency</label>
                          <select
                            value={dailyHabitFormsFrequency}
                            onChange={(e) => setDailyHabitFormsFrequency(e.target.value as 'weekly' | 'monthly')}
                            className="w-full bg-input text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-foreground">
                            Units per {dailyHabitFormsFrequency === 'weekly' ? 'Week' : 'Month'}
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={dailyHabitFormsUnits ?? ''}
                            onChange={(e) => setDailyHabitFormsUnits(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 7"
                            className="bg-input text-foreground border-border"
                          />
                        </div>
                      </div>

                      {/* Cost or Include in Total */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="daily_habit_forms_included"
                            checked={dailyHabitFormsIncluded}
                            onChange={(e) => {
                              setDailyHabitFormsIncluded(e.target.checked)
                              if (e.target.checked) {
                                setDailyHabitFormsCost(null)
                              }
                            }}
                            className="w-4 h-4 rounded border-border"
                          />
                          <label htmlFor="daily_habit_forms_included" className="text-sm text-foreground cursor-pointer">
                            Include in total package cost (no additional cost)
                          </label>
                        </div>

                        {!dailyHabitFormsIncluded && (
                          <div>
                            <label className="block text-sm font-medium mb-1 text-foreground">
                              Cost Per Billing Cycle ($)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={dailyHabitFormsCost ?? ''}
                              onChange={(e) => setDailyHabitFormsCost(e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="0.00"
                              className="bg-input text-foreground border-border"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 6: Cost Overview */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Cost Overview</h3>
                  <p className="text-sm text-muted-foreground mb-4">Review the calculated costs for this package.</p>
                </div>

                {/* Cost Calculation */}
                <div className="space-y-4">
                  {(() => {
                    const calculatedCost = calculateCosts()
                    const cycleWeeks = formData.cycle_length_weeks || 1
                    const totalWeeks = formData.package_length_weeks || (billingType === 'PIF' ? 0 : cycleWeeks)

                    return (
                      <>
                        {/* Sessions Breakdown */}
                        {offeringSessions === true && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">Sessions</h4>
                            <div className="flex justify-between items-center p-3 bg-background border border-border rounded-md">
                              <div>
                                <span className="text-sm font-medium text-foreground">
                                  {sessionServices.find(s => s.id === sessionServiceId)?.name || 'Session'}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {sessionsIncludedInCost 
                                    ? 'Included in total package cost'
                                    : `${sessionUnits || 0} units per ${sessionFrequency === 'weekly' ? 'week' : 'month'} × $${sessionUnitCost?.toFixed(2) || 0} per unit`}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                {sessionsIncludedInCost ? 'Included' : `$${sessionUnitCost?.toFixed(2) || 0} per unit`}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Workout Programming Breakdown */}
                        {offeringWorkoutProgramming === true && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">Workout Programming</h4>
                            <div className="flex justify-between items-center p-3 bg-background border border-border rounded-md">
                              <div>
                                <span className="text-sm font-medium text-foreground">Programmed Workouts</span>
                                <p className="text-xs text-muted-foreground">
                                  {workoutProgrammingIncluded 
                                    ? 'Included in total package cost'
                                    : `${workoutUnits || 0} units per ${workoutFrequency === 'weekly' ? 'week' : 'month'} × $${workoutProgrammingCost?.toFixed(2) || 0} per cycle`}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                {workoutProgrammingIncluded ? 'Included' : `$${(workoutProgrammingCost || 0).toFixed(2)} per cycle`}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Nutrition Programming Breakdown */}
                        {offeringNutritionProgramming === true && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">Nutrition Programming</h4>
                            <div className="flex justify-between items-center p-3 bg-background border border-border rounded-md">
                              <div>
                                <span className="text-sm font-medium text-foreground">
                                  {nutritionType === 'full_meal' ? 'Full Meal Programming' : 'Macro Check-in Only'}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {nutritionProgrammingIncluded 
                                    ? 'Included in total package cost'
                                    : `${nutritionUnits || 0} units per ${nutritionFrequency === 'weekly' ? 'week' : 'month'} × $${nutritionProgrammingCost?.toFixed(2) || 0} per cycle`}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                {nutritionProgrammingIncluded ? 'Included' : `$${(nutritionProgrammingCost || 0).toFixed(2)} per cycle`}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Total Cost Display */}
                        <div className="pt-4 border-t-2 border-border">
                          <div className="space-y-2">
                            {billingType === 'PIF' && (
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-foreground">Calculated Total Cost:</span>
                                  <span className="text-sm text-muted-foreground">${calculatedCost.toFixed(2)}</span>
                                </div>
                                {(calculatedCost === 0 || customCostPerCycle !== null) && (
                                  <div className="pt-2 border-t border-border">
                                    <div className="flex justify-between items-center gap-4">
                                      <label className="text-sm font-medium text-foreground">Custom Total Package Cost ($):</label>
                                      <Input
                                        type="number"
                                        min={calculatedCost}
                                        step="0.01"
                                        value={customCostPerCycle ?? calculatedCost}
                                        onChange={(e) => {
                                          const value = e.target.value ? parseFloat(e.target.value) : null
                                          if (value !== null && value >= calculatedCost) {
                                            setCustomCostPerCycle(value)
                                          } else if (value === null || value === calculatedCost) {
                                            setCustomCostPerCycle(null)
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const value = e.target.value ? parseFloat(e.target.value) : null
                                          if (value !== null && value < calculatedCost) {
                                            setCustomCostPerCycle(null)
                                            alert(`Custom cost cannot be less than the calculated cost of $${calculatedCost.toFixed(2)}`)
                                          }
                                        }}
                                        className="w-32 bg-input text-foreground border-border text-right"
                                        placeholder={calculatedCost.toFixed(2)}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 text-right">
                                      Minimum: ${calculatedCost.toFixed(2)}
                                    </p>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t-2 border-border">
                                  <span className="text-lg font-semibold text-foreground">Total Package Cost (PIF):</span>
                                  <span className="text-lg font-semibold text-foreground">
                                    ${(customCostPerCycle ?? calculatedCost).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                            {(billingType === 'recurring' || billingType === 'recurring_with_down_payment') && (
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-foreground">Calculated Cost Per Billing Cycle:</span>
                                  <span className="text-sm text-muted-foreground">${calculatedCost.toFixed(2)}</span>
                                </div>
                                <div className="pt-2 border-t border-border">
                                  <div className="flex justify-between items-center gap-4">
                                    <label className="text-sm font-medium text-foreground">Custom Cost Per Cycle ($):</label>
                                    <Input
                                      type="number"
                                      min={calculatedCost}
                                      step="0.01"
                                      value={customCostPerCycle ?? calculatedCost}
                                      onChange={(e) => {
                                        const value = e.target.value ? parseFloat(e.target.value) : null
                                        if (value !== null && value >= calculatedCost) {
                                          setCustomCostPerCycle(value)
                                        } else if (value === null || value === calculatedCost) {
                                          setCustomCostPerCycle(null)
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const value = e.target.value ? parseFloat(e.target.value) : null
                                        if (value !== null && value < calculatedCost) {
                                          setCustomCostPerCycle(null)
                                          alert(`Custom cost cannot be less than the calculated cost of $${calculatedCost.toFixed(2)}`)
                                        }
                                      }}
                                      className="w-32 bg-input text-foreground border-border text-right"
                                      placeholder={calculatedCost.toFixed(2)}
                                    />
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 text-right">
                                    Minimum: ${calculatedCost.toFixed(2)}
                                  </p>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-border">
                                  <span className="text-lg font-semibold text-foreground">Per-Cycle Cost:</span>
                                  <span className="text-lg font-semibold text-foreground">
                                    ${(customCostPerCycle ?? calculatedCost).toFixed(2)}
                                  </span>
                                </div>
                                {!isIndefinite && totalWeeks > 0 && (
                                  <p className="text-xs text-muted-foreground text-right">
                                    Total over {totalWeeks} weeks: ${((customCostPerCycle ?? calculatedCost) * (totalWeeks / cycleWeeks)).toFixed(2)}
                                  </p>
                                )}
                                {billingType === 'recurring_with_down_payment' && (
                                  <div className="pt-2 border-t border-border">
                                    <div className="flex justify-between items-center">
                                      <label className="text-sm font-medium text-foreground">Down Payment ($):</label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={downPayment || ''}
                                        onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-32 bg-input text-foreground border-border text-right"
                                      />
                                    </div>
                                    {downPayment > 0 && !isIndefinite && totalWeeks > 0 && (
                                      <p className="text-xs text-muted-foreground text-right mt-1">
                                        Total: ${downPayment.toFixed(2)} down + ${((customCostPerCycle ?? calculatedCost) * (totalWeeks / cycleWeeks)).toFixed(2)} recurring = ${(downPayment + (customCostPerCycle ?? calculatedCost) * (totalWeeks / cycleWeeks)).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Warnings */}
                        <div className="space-y-2 pt-2">
                          {offeringSessions === true && !sessionsIncludedInCost && (!sessionUnitCost || sessionUnitCost <= 0) && (
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Sessions are missing unit cost
                              </p>
                            </div>
                          )}
                          {offeringWorkoutProgramming === true && !workoutProgrammingIncluded && (!workoutProgrammingCost || workoutProgrammingCost <= 0) && (
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Workout programming is missing cost
                              </p>
                            </div>
                          )}
                          {offeringNutritionProgramming === true && !nutritionProgrammingIncluded && (!nutritionProgrammingCost || nutritionProgrammingCost <= 0) && (
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Nutrition programming is missing cost
                              </p>
                            </div>
                          )}
                          {calculatedCost <= 0 && (offeringSessions === true || offeringWorkoutProgramming === true || offeringNutritionProgramming === true || offeringCheckInForms === true || offeringDailyHabitForms === true) && (
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Total cost is $0.00. All items may be set to "included" or missing costs.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Step 7: Optional Add-ons / Rules */}
            {currentStep === 7 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Optional Add-ons / Rules</h3>
                  <p className="text-sm text-muted-foreground mb-4">Configure constraints, limits, and package-specific settings.</p>
                </div>

                {/* Constraints / Limits */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">Constraints / Limits</label>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-muted-foreground">
                      Max Sessions per Week (optional)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={packageConstraints.max_sessions_per_week ?? ''}
                      onChange={(e) => setPackageConstraints({
                        ...packageConstraints,
                        max_sessions_per_week: e.target.value ? parseInt(e.target.value) : null
                      })}
                      placeholder="Leave empty for no limit"
                      className="bg-input text-foreground border-border"
                    />
                  </div>
                </div>

                {/* Package-specific Tasks / Reminders */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="block text-sm font-medium text-foreground">Package-specific Tasks / Reminders</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto_create_tasks"
                      checked={packageConstraints.auto_create_tasks}
                      onChange={(e) => setPackageConstraints({
                        ...packageConstraints,
                        auto_create_tasks: e.target.checked
                      })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <label htmlFor="auto_create_tasks" className="text-sm text-foreground cursor-pointer">
                      Auto-create tasks for programmed workouts or check-ins
                    </label>
                  </div>
                </div>

                {/* Notes for Trainer */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="block text-sm font-medium text-foreground">Notes for Trainer</label>
                  <Textarea
                    value={packageConstraints.trainer_notes || ''}
                    onChange={(e) => setPackageConstraints({
                      ...packageConstraints,
                      trainer_notes: e.target.value || null
                    })}
                    placeholder="Add any notes or reminders for yourself about this package..."
                    className="bg-input text-foreground border-border"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Step 8: Review & Save */}
            {currentStep === 8 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Review & Save</h3>
                  <p className="text-sm text-muted-foreground mb-4">Review all selections and add any additional notes before saving the package.</p>
                </div>

                {/* Additional Notes */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">Additional Notes</label>
                  <Textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                    placeholder="Add any additional notes about this package..."
                    className="bg-input text-foreground border-border"
                    rows={4}
                  />
                </div>

                {/* Summary */}
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="p-4 bg-background border border-border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">Basic Package Info</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> <span className="text-foreground">{formData.name}</span></p>
                      {formData.description && (
                        <p><span className="text-muted-foreground">Description:</span> <span className="text-foreground">{formData.description}</span></p>
                      )}
                      <p><span className="text-muted-foreground">Billing Type:</span> <span className="text-foreground capitalize">{billingType.replace('_', ' ')}</span></p>
                      {billingType !== 'PIF' && (
                        <p><span className="text-muted-foreground">Cycle Length:</span> <span className="text-foreground">{formData.cycle_length_weeks} weeks</span></p>
                      )}
                      {!isIndefinite && formData.package_length_weeks > 0 && (
                        <p><span className="text-muted-foreground">Total Duration:</span> <span className="text-foreground">{formData.package_length_weeks} weeks</span></p>
                      )}
                      {isIndefinite && (
                        <p><span className="text-muted-foreground">Duration:</span> <span className="text-foreground">Indefinite</span></p>
                      )}
                      <p><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{formData.is_active ? 'Active' : 'Inactive'}</span></p>
                    </div>
                  </div>

                  {/* Sessions */}
                  {offeringSessions === true && (
                    <div className="p-4 bg-background border border-border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">Sessions</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentStep(2)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{sessionServices.find(s => s.id === sessionServiceId)?.name || 'Not selected'}</span></p>
                        <p><span className="text-muted-foreground">Frequency:</span> <span className="text-foreground capitalize">{sessionFrequency}</span></p>
                        <p><span className="text-muted-foreground">Units:</span> <span className="text-foreground">{sessionUnits || 0} per {sessionFrequency === 'weekly' ? 'week' : 'month'}</span></p>
                        <p><span className="text-muted-foreground">Cost:</span> <span className="text-foreground">
                          {sessionsIncludedInCost ? 'Included' : `$${sessionUnitCost?.toFixed(2) || 0} per unit`}
                        </span></p>
                      </div>
                    </div>
                  )}

                  {/* Workout Programming */}
                  {offeringWorkoutProgramming === true && (
                    <div className="p-4 bg-background border border-border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">Workout Programming</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentStep(3)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Frequency:</span> <span className="text-foreground capitalize">{workoutFrequency}</span></p>
                        <p><span className="text-muted-foreground">Units:</span> <span className="text-foreground">{workoutUnits || 0} per {workoutFrequency === 'weekly' ? 'week' : 'month'}</span></p>
                        <p><span className="text-muted-foreground">Cost:</span> <span className="text-foreground">
                          {workoutProgrammingIncluded ? 'Included' : `$${workoutProgrammingCost?.toFixed(2) || 0} per cycle`}
                        </span></p>
                      </div>
                    </div>
                  )}

                  {/* Nutrition Programming */}
                  {offeringNutritionProgramming === true && (
                    <div className="p-4 bg-background border border-border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">Nutrition Programming</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentStep(4)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Type:</span> <span className="text-foreground">
                          {nutritionType === 'full_meal' ? 'Full Meal Programming' : 'Macro Check-in Only'}
                        </span></p>
                        <p><span className="text-muted-foreground">Frequency:</span> <span className="text-foreground capitalize">{nutritionFrequency}</span></p>
                        <p><span className="text-muted-foreground">Units:</span> <span className="text-foreground">{nutritionUnits || 0} per {nutritionFrequency === 'weekly' ? 'week' : 'month'}</span></p>
                        <p><span className="text-muted-foreground">Cost:</span> <span className="text-foreground">
                          {nutritionProgrammingIncluded ? 'Included' : `$${nutritionProgrammingCost?.toFixed(2) || 0} per cycle`}
                        </span></p>
                      </div>
                    </div>
                  )}

                  {/* Check-in Forms & Daily Habit Forms */}
                  {(offeringCheckInForms === true || offeringDailyHabitForms === true) && (
                    <div className="p-4 bg-background border border-border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">Forms</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentStep(5)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm">
                        {offeringCheckInForms === true && (
                          <p><span className="text-muted-foreground">Check-in Forms:</span> <span className="text-foreground">
                            {checkInFormsUnits || 0} per {checkInFormsFrequency === 'weekly' ? 'week' : 'month'} - {checkInFormsIncluded ? 'Included' : `$${checkInFormsCost?.toFixed(2) || 0} per cycle`}
                          </span></p>
                        )}
                        {offeringDailyHabitForms === true && (
                          <p><span className="text-muted-foreground">Daily Habit Forms:</span> <span className="text-foreground">
                            {dailyHabitFormsUnits || 0} per {dailyHabitFormsFrequency === 'weekly' ? 'week' : 'month'} - {dailyHabitFormsIncluded ? 'Included' : `$${dailyHabitFormsCost?.toFixed(2) || 0} per cycle`}
                          </span></p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cost Summary */}
                  <div className="p-4 bg-background border border-border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">Cost Summary</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep(6)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="text-sm space-y-1">
                      {billingType === 'PIF' && (() => {
                        const finalCost = customCostPerCycle ?? calculateCosts()
                        return (
                          <p><span className="text-muted-foreground">Total Package Cost:</span> <span className="text-foreground font-semibold">${finalCost.toFixed(2)}</span></p>
                        )
                      })()}
                      {(billingType === 'recurring' || billingType === 'recurring_with_down_payment') && (() => {
                        const finalCost = customCostPerCycle ?? calculateCosts()
                        return (
                          <>
                            <p><span className="text-muted-foreground">Per-Cycle Cost:</span> <span className="text-foreground font-semibold">${finalCost.toFixed(2)}</span></p>
                            {!isIndefinite && formData.package_length_weeks > 0 && formData.cycle_length_weeks > 0 && billingType !== 'PIF' && (
                              <p className="text-xs text-muted-foreground">
                                Total over {formData.package_length_weeks} weeks: ${(finalCost * (formData.package_length_weeks / formData.cycle_length_weeks)).toFixed(2)}
                              </p>
                            )}
                            {billingType === 'recurring_with_down_payment' && downPayment > 0 && (
                              <p><span className="text-muted-foreground">Down Payment:</span> <span className="text-foreground font-semibold">${downPayment.toFixed(2)}</span></p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Constraints */}
                  {(packageConstraints.max_sessions_per_week || packageConstraints.auto_create_tasks || packageConstraints.trainer_notes) && (
                    <div className="p-4 bg-background border border-border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">Add-ons / Rules</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentStep(7)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm">
                        {packageConstraints.max_sessions_per_week && (
                          <p><span className="text-muted-foreground">Max Sessions/Week:</span> <span className="text-foreground">{packageConstraints.max_sessions_per_week}</span></p>
                        )}
                        {packageConstraints.auto_create_tasks && (
                          <p><span className="text-muted-foreground">Auto-create Tasks:</span> <span className="text-foreground">Enabled</span></p>
                        )}
                        {packageConstraints.trainer_notes && (
                          <p><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{packageConstraints.trainer_notes}</span></p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setAddDialogOpen(false)}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button
                  onClick={handlePreviousStep}
                  variant="outline"
                  className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                >
                  Previous
                </Button>
              )}
              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNextStep}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Package'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Package Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
            <DialogDescription>Update package details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Package Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Monthly Training Package"
                className="bg-input text-foreground border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Description (optional)</label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                placeholder="Package description..."
                className="bg-input text-foreground border-border"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Cycle Length (weeks)</label>
              <Input
                type="number"
                min="1"
                value={formData.cycle_length_weeks || ''}
                onChange={(e) => setFormData({ ...formData, cycle_length_weeks: parseInt(e.target.value) || 0 })}
                placeholder="Number of weeks per cycle"
                className="bg-input text-foreground border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Package Length (weeks)</label>
              <Input
                type="number"
                min="1"
                value={formData.package_length_weeks || ''}
                onChange={(e) => setFormData({ ...formData, package_length_weeks: parseInt(e.target.value) || 0 })}
                placeholder="Total package duration in weeks"
                className="bg-input text-foreground border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Default Cost per Cycle ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.default_cost_per_cycle || ''}
                onChange={(e) => setFormData({ ...formData, default_cost_per_cycle: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="bg-input text-foreground border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active_edit"
                checked={formData.is_active ?? true}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="is_active_edit" className="text-sm font-medium text-foreground cursor-pointer">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setEditDialogOpen(false)}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Update Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Package Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle>Delete Package</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{editingPackage?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deletingPackage}
            >
              {deletingPackage ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

