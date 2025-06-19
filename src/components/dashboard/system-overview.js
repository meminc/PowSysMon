// src/components/dashboard/system-overview.js
import { 
    Zap, 
    AlertCircle, 
    Activity, 
    TrendingUp,
    ArrowUp,
    ArrowDown
  } from 'lucide-react';
  import { Card } from '@/components/ui/card';
  import { cn } from '@/lib/utils';
  
  export default function SystemOverview({ data }) {
    const stats = [
      {
        label: 'Total Generation',
        value: data?.current?.generation?.toFixed(2) || '0',
        unit: 'MW',
        change: '+2.5%',
        trend: 'up',
        icon: Zap,
        color: 'blue'
      },
      {
        label: 'Total Load',
        value: data?.current?.load?.toFixed(2) || '0',
        unit: 'MW',
        change: '-1.2%',
        trend: 'down',
        icon: Activity,
        color: 'green'
      },
      {
        label: 'System Frequency',
        value: data?.current?.frequency?.toFixed(2) || '50.00',
        unit: 'Hz',
        change: '0.0%',
        trend: 'stable',
        icon: TrendingUp,
        color: 'purple'
      },
      {
        label: 'Active Alarms',
        value: data?.events?.active || '0',
        unit: '',
        change: data?.events?.critical > 0 ? `${data.events.critical} critical` : 'No critical',
        trend: data?.events?.critical > 0 ? 'alert' : 'stable',
        icon: AlertCircle,
        color: 'red'
      }
    ];
  
    const getColorClasses = (color) => {
      const colors = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        red: 'bg-red-50 text-red-600 border-red-200'
      };
      return colors[color] || colors.blue;
    };
  
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = getColorClasses(stat.color);
          
          return (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <div className="mt-2 flex items-baseline">
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    <span className="ml-1 text-sm text-gray-500">{stat.unit}</span>
                  </div>
                  <div className="mt-2">
                    <span className={cn(
                      'inline-flex items-center text-sm font-medium',
                      stat.trend === 'up' && 'text-green-600',
                      stat.trend === 'down' && 'text-blue-600',
                      stat.trend === 'alert' && 'text-red-600',
                      stat.trend === 'stable' && 'text-gray-600'
                    )}>
                      {stat.trend === 'up' && <ArrowUp className="h-3 w-3 mr-1" />}
                      {stat.trend === 'down' && <ArrowDown className="h-3 w-3 mr-1" />}
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  'p-3 rounded-lg border',
                  colorClasses
                )}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }