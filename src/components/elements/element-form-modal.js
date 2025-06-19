'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Save, Loader2 } from 'lucide-react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/form/input';
import LineCoordinatesForm from '@/components/elements/line-coordinates-form';
import { useCreateElement, useUpdateElement } from '@/hooks/api/useElements';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Base element schema
const baseElementSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'fault']),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
});

// Type-specific schemas
const loadPropertiesSchema = z.object({
  load_type: z.enum(['residential', 'commercial', 'industrial']),
  connection_type: z.enum(['single_phase', 'three_phase']),
  rated_power: z.coerce.number().positive('Rated power must be positive'),
  power_factor: z.coerce.number().min(0).max(1),
  voltage_level: z.coerce.number().positive('Voltage level must be positive'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
});

const generatorPropertiesSchema = z.object({
  generation_type: z.enum(['solar', 'wind', 'hydro', 'thermal', 'nuclear', 'battery']),
  rated_capacity: z.coerce.number().positive('Rated capacity must be positive'),
  min_capacity: z.coerce.number().nonnegative('Min capacity cannot be negative'),
  max_capacity: z.coerce.number().positive('Max capacity must be positive'),
  efficiency: z.coerce.number().min(0).max(1).optional(),
  fuel_type: z.string().optional(),
  voltage_level: z.coerce.number().positive('Voltage level must be positive'),
});

const busPropertiesSchema = z.object({
  voltage_level: z.coerce.number().positive('Voltage level must be positive'),
  bus_type: z.enum(['slack', 'pv', 'pq']),
  nominal_voltage: z.coerce.number().positive().optional(),
});

const transformerPropertiesSchema = z.object({
  primary_voltage: z.coerce.number().positive('Primary voltage must be positive'),
  secondary_voltage: z.coerce.number().positive('Secondary voltage must be positive'),
  rated_power: z.coerce.number().positive('Rated power must be positive'),
  current_tap: z.coerce.number().int().optional(),
  winding_configuration: z.string().optional(),
  cooling_type: z.string().optional(),
});

const linePropertiesSchema = z.object({
  voltage_level: z.coerce.number().positive('Voltage level must be positive'),
  length: z.coerce.number().positive().optional(), // Auto-calculated
  conductor_type: z.string().optional(),
  rated_current: z.coerce.number().positive().optional(),
  resistance: z.coerce.number().nonnegative().optional(),
  reactance: z.coerce.number().nonnegative().optional(),
  coordinates: z.array(z.object({
    latitude: z.coerce.number().min(-90).max(90, 'Invalid latitude'),
    longitude: z.coerce.number().min(-180).max(180, 'Invalid longitude'),
    elevation: z.coerce.number().optional(),
    point_type: z.enum(['start', 'end', 'intermediate', 'tower', 'junction']),
    description: z.string().optional()
  })).min(2, 'At least 2 coordinate points are required')
});

const ELEMENT_TYPES = [
  { value: 'load', label: 'Load' },
  { value: 'generator', label: 'Generator' },
  { value: 'bus', label: 'Bus' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'line', label: 'Line' },
];

export default function ElementFormModal({ element, onClose }) {
  const [elementType, setElementType] = useState(element?.element_type || 'load');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createElement = useCreateElement();
  const updateElement = useUpdateElement();
  
  const isEditing = !!element;

  // Dynamic schema based on element type
  const getSchema = () => {
    let schema = baseElementSchema.extend({
      type: z.literal(elementType),
    });

    switch (elementType) {
      case 'load':
        schema = schema.extend({
          load_properties: loadPropertiesSchema,
        });
        break;
      case 'generator':
        schema = schema.extend({
          generator_properties: generatorPropertiesSchema,
        });
        break;
      case 'bus':
        schema = schema.extend({
          bus_properties: busPropertiesSchema,
        });
        break;
      case 'transformer':
        schema = schema.extend({
          transformer_properties: transformerPropertiesSchema,
        });
        break;
      case 'line':
        schema = schema.extend({
          line_properties: linePropertiesSchema,
        });
        break;
    }

    return schema;
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(getSchema()),
    defaultValues: {
      type: elementType,
      name: '',
      description: '',
      status: 'active',
      latitude: '',
      longitude: '',
      address: '',
      manufacturer: '',
      model: '',
      ...getDefaultProperties(elementType),
    },
  });

  // Update form when element type changes
  useEffect(() => {
    setValue('type', elementType);
    const defaults = getDefaultProperties(elementType);
    Object.entries(defaults).forEach(([key, value]) => {
      setValue(key, value);
    });
  }, [elementType, setValue]);

  // Load existing element data
  useEffect(() => {
    if (element) {
      reset({
        type: element.element_type,
        name: element.name,
        description: element.description || '',
        status: element.status,
        latitude: element.latitude || '',
        longitude: element.longitude || '',
        address: element.address || '',
        manufacturer: element.manufacturer || '',
        model: element.model || '',
        [`${element.element_type}_properties`]: element.properties || getDefaultProperties(element.element_type)[`${element.element_type}_properties`],
      });
      setElementType(element.element_type);
    }
  }, [element, reset]);

  function getDefaultProperties(type) {
    const defaults = {
      load: {
        load_properties: {
          load_type: 'commercial',
          connection_type: 'three_phase',
          rated_power: '',
          power_factor: '0.95',
          voltage_level: '',
          priority: 'medium',
        }
      },
      generator: {
        generator_properties: {
          generation_type: 'solar',
          rated_capacity: '',
          min_capacity: '0',
          max_capacity: '',
          efficiency: '0.95',
          fuel_type: '',
          voltage_level: '',
        }
      },
      bus: {
        bus_properties: {
          voltage_level: '',
          bus_type: 'pq',
          nominal_voltage: '',
        }
      },
      transformer: {
        transformer_properties: {
          primary_voltage: '',
          secondary_voltage: '',
          rated_power: '',
          current_tap: '0',
          winding_configuration: '',
          cooling_type: '',
        }
      },
      line: {
        line_properties: {
          voltage_level: '',
          length: '',
          conductor_type: '',
          rated_current: '',
          resistance: '',
          reactance: '',
          coordinates: [
            { latitude: '', longitude: '', elevation: '', point_type: 'start', description: 'Starting point' },
            { latitude: '', longitude: '', elevation: '', point_type: 'end', description: 'Ending point' }
          ]
        }
      }
    };

    return defaults[type] || {};
  }

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const formattedData = {
        ...data,
        location: data.latitude && data.longitude ? {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          address: data.address,
        } : undefined,
      };

      // Remove latitude/longitude from root level
      delete formattedData.latitude;
      delete formattedData.longitude;
      delete formattedData.address;

      if (isEditing) {
        await updateElement.mutateAsync({ id: element.id, data: formattedData });
        toast.success('Element updated successfully');
      } else {
        await createElement.mutateAsync(formattedData);
        toast.success('Element created successfully');
      }
      
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save element');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (elementType) {
      case 'load':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Load Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Load Type
                </label>
                <select
                  {...register('load_properties.load_type')}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                </select>
                {errors.load_properties?.load_type && (
                  <p className="text-red-500 text-sm mt-1">{errors.load_properties.load_type.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection Type
                </label>
                <select
                  {...register('load_properties.connection_type')}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md"
                >
                  <option value="single_phase">Single Phase</option>
                  <option value="three_phase">Three Phase</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rated Power (MW)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('load_properties.rated_power')}
                  error={errors.load_properties?.rated_power?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Power Factor
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  {...register('load_properties.power_factor')}
                  error={errors.load_properties?.power_factor?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voltage Level (kV)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('load_properties.voltage_level')}
                  error={errors.load_properties?.voltage_level?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  {...register('load_properties.priority')}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'generator':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Generator Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generation Type
                </label>
                <select
                  {...register('generator_properties.generation_type')}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md"
                >
                  <option value="solar">Solar</option>
                  <option value="wind">Wind</option>
                  <option value="hydro">Hydro</option>
                  <option value="thermal">Thermal</option>
                  <option value="nuclear">Nuclear</option>
                  <option value="battery">Battery</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rated Capacity (MW)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('generator_properties.rated_capacity')}
                  error={errors.generator_properties?.rated_capacity?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Capacity (MW)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('generator_properties.min_capacity')}
                  error={errors.generator_properties?.min_capacity?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Capacity (MW)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('generator_properties.max_capacity')}
                  error={errors.generator_properties?.max_capacity?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Efficiency
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  {...register('generator_properties.efficiency')}
                  error={errors.generator_properties?.efficiency?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voltage Level (kV)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('generator_properties.voltage_level')}
                  error={errors.generator_properties?.voltage_level?.message}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuel Type
                </label>
                <Input
                  {...register('generator_properties.fuel_type')}
                  placeholder="e.g., Natural Gas, Coal, etc."
                />
              </div>
            </div>
          </div>
        );

      case 'bus':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Bus Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voltage Level (kV)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('bus_properties.voltage_level')}
                  error={errors.bus_properties?.voltage_level?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bus Type
                </label>
                <select
                  {...register('bus_properties.bus_type')}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md"
                >
                  <option value="slack">Slack Bus</option>
                  <option value="pv">PV Bus</option>
                  <option value="pq">PQ Bus</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nominal Voltage (kV)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('bus_properties.nominal_voltage')}
                />
              </div>
            </div>
          </div>
        );

      case 'transformer':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Transformer Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Voltage (kV)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('transformer_properties.primary_voltage')}
                  error={errors.transformer_properties?.primary_voltage?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Voltage (kV)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('transformer_properties.secondary_voltage')}
                  error={errors.transformer_properties?.secondary_voltage?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rated Power (MVA)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('transformer_properties.rated_power')}
                  error={errors.transformer_properties?.rated_power?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Tap
                </label>
                <Input
                  type="number"
                  {...register('transformer_properties.current_tap')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Winding Configuration
                </label>
                <Input
                  {...register('transformer_properties.winding_configuration')}
                  placeholder="e.g., Delta-Wye"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cooling Type
                </label>
                <Input
                  {...register('transformer_properties.cooling_type')}
                  placeholder="e.g., ONAN, ONAF"
                />
              </div>
            </div>
          </div>
        );

      case 'line':
        return <LineCoordinatesForm register={register} errors={errors} watch={watch} setValue={setValue} />;

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Element' : 'Create New Element'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Element Type Selection */}
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Element Type
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {ELEMENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setElementType(type.value)}
                      className={cn(
                        'p-3 text-center border rounded-lg transition-colors',
                        elementType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <Input
                    {...register('name')}
                    error={errors.name?.message}
                    placeholder="Enter element name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="fault">Fault</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                    placeholder="Enter element description"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Location</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude
                  </label>
                  <Input
                    type="number"
                    step="any"
                    {...register('latitude')}
                    error={errors.latitude?.message}
                    placeholder="e.g., 40.7128"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude
                  </label>
                  <Input
                    type="number"
                    step="any"
                    {...register('longitude')}
                    error={errors.longitude?.message}
                    placeholder="e.g., -74.0060"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <Input
                    {...register('address')}
                    placeholder="Physical address"
                  />
                </div>
              </div>
            </div>

            {/* Equipment Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Equipment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  <Input
                    {...register('manufacturer')}
                    placeholder="Equipment manufacturer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <Input
                    {...register('model')}
                    placeholder="Equipment model"
                  />
                </div>
              </div>
            </div>

            {/* Type-specific properties */}
            {renderTypeSpecificFields()}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Update Element' : 'Create Element'}
          </Button>
        </div>
      </div>
    </div>
  );
}