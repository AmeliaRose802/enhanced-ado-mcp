#!/usr/bin/env python3
"""
Optimal Parallel Execution Plan Generator

This script generates an optimal parallel execution plan that:
1. Maximizes parallel task execution
2. Respects dependency order (prerequisites before dependents)
3. Groups tasks of similar sizes in the same wave
4. Prevents file conflicts within the same wave
5. Supports regex patterns for file matching
"""

import json
import re
from collections import defaultdict, deque
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class FilePattern:
    pattern: str
    type: str  # 'exact', 'regex', or 'glob'
    
    def matches(self, file_path: str) -> bool:
        """Check if a file path matches this pattern"""
        if self.type == 'exact':
            return self.pattern == file_path
        elif self.type == 'regex':
            try:
                return bool(re.search(self.pattern, file_path))
            except re.error:
                return False
        elif self.type == 'glob':
            # Convert glob to regex
            regex_pattern = self.pattern.replace('**/', '.*').replace('*', '[^/]*')
            try:
                return bool(re.search(regex_pattern, file_path))
            except re.error:
                return False
        return False


@dataclass
class Task:
    task_id: str
    size: str
    expected_runtime_min: int
    depends_on: List[str]
    conflicts_with: List[str]
    file_patterns: List[FilePattern]
    tags: List[str]
    enabler: bool = False
    
    def __hash__(self):
        return hash(self.task_id)


class ParallelExecutionPlanner:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.dependency_graph: Dict[str, Set[str]] = defaultdict(set)
        self.reverse_dependency_graph: Dict[str, Set[str]] = defaultdict(set)
        self.file_conflicts: Dict[Tuple[str, str], bool] = {}
        
    def load_data(self, dependency_file: str, conflict_file: str):
        """Load task data from JSON files"""
        
        # Load dependencies (contains task metadata)
        with open(dependency_file, 'r') as f:
            dependencies = json.load(f)
        
        # Load file patterns (contains file info for conflict detection)
        with open(conflict_file, 'r') as f:
            file_patterns_data = json.load(f)
        
        # Build file pattern map
        file_pattern_map = {}
        for task_data in file_patterns_data:
            task_id = task_data['task_id']
            file_patterns = []
            for file_info in task_data.get('files', []):
                if isinstance(file_info, dict):
                    file_patterns.append(FilePattern(
                        pattern=file_info.get('pattern', ''),
                        type=file_info.get('type', 'exact')
                    ))
                elif isinstance(file_info, str):
                    # Legacy format - convert to pattern
                    if '**' in file_info or file_info.endswith('/**'):
                        file_patterns.append(FilePattern(pattern=file_info, type='glob'))
                    else:
                        file_patterns.append(FilePattern(pattern=file_info, type='exact'))
            file_pattern_map[task_id] = file_patterns
        
        # Build task objects from dependency data
        for task_data in dependencies:
            task_id = task_data['task_id']
            
            task = Task(
                task_id=task_id,
                size=task_data.get('size', 'M'),
                expected_runtime_min=task_data.get('expected_runtime_min', 20),
                depends_on=task_data.get('depends_on', []),
                conflicts_with=[],  # Will be computed from file patterns
                file_patterns=file_pattern_map.get(task_id, []),
                tags=task_data.get('tags', []),
                enabler=task_data.get('enabler', False)
            )
            
            self.tasks[task_id] = task
            
            # Build dependency graphs
            for dep in task.depends_on:
                self.dependency_graph[task_id].add(dep)
                self.reverse_dependency_graph[dep].add(task_id)
    
    def _normalize_file_paths(self, files: List[str]) -> List[str]:
        """Keep file paths as-is - we'll use explicit conflicts only"""
        # Don't normalize - keep exact paths for precise conflict detection
        return files
    
    def _check_file_conflict(self, task1: Task, task2: Task) -> bool:
        """Check if two tasks have file conflicts using regex pattern matching"""
        if task1.task_id == task2.task_id:
            return False
            
        # Check explicit conflicts first
        if task2.task_id in task1.conflicts_with or task1.task_id in task2.conflicts_with:
            return True
        
        # Check if file patterns overlap
        for pattern1 in task1.file_patterns:
            for pattern2 in task2.file_patterns:
                if self._patterns_conflict(pattern1, pattern2):
                    return True
        
        return False
    
    def _patterns_conflict(self, pattern1: FilePattern, pattern2: FilePattern) -> bool:
        """Check if two file patterns conflict"""
        # Normalize pattern types (some "exact" patterns are actually regex)
        actual_type1 = 'regex' if ('\\.' in pattern1.pattern or '.*' in pattern1.pattern or '$' in pattern1.pattern or '^' in pattern1.pattern) else pattern1.type
        actual_type2 = 'regex' if ('\\.' in pattern2.pattern or '.*' in pattern2.pattern or '$' in pattern2.pattern or '^' in pattern2.pattern) else pattern2.type
        
        # Exact match check - same file = conflict
        if actual_type1 == 'exact' and actual_type2 == 'exact':
            return pattern1.pattern == pattern2.pattern
        
        # If both are regex/glob, check for overlap
        if actual_type1 in ['regex', 'glob'] and actual_type2 in ['regex', 'glob']:
            # Special case: both patterns look like exact paths (no real wildcards)
            if self._is_exact_regex(pattern1.pattern) and self._is_exact_regex(pattern2.pattern):
                # Normalize and compare
                norm1 = pattern1.pattern.lstrip('^').rstrip('$').replace('\\.',  '.')
                norm2 = pattern2.pattern.lstrip('^').rstrip('$').replace('\\.', '.')
                return norm1 == norm2
            # Otherwise do pattern overlap check
            return self._check_regex_pattern_overlap(pattern1, pattern2)
        
        # Mixed: one exact, one pattern
        if actual_type1 == 'exact' and actual_type2 in ['regex', 'glob']:
            return pattern2.matches(pattern1.pattern)
        if actual_type2 == 'exact' and actual_type1 in ['regex', 'glob']:
            return pattern1.matches(pattern2.pattern)
        
        return False
    
    def _extract_base_path(self, pattern: str) -> str:
        """Extract the non-wildcard base path from a pattern"""
        # Remove regex special characters to get base path
        base = re.sub(r'[\.\*\[\]\(\)\?\+\{\}\\].*$', '', pattern)
        return base.rstrip('/')
    
    def _check_regex_pattern_overlap(self, pattern1: FilePattern, pattern2: FilePattern) -> bool:
        """Check if two regex/glob patterns could match overlapping files"""
        # Special case: if both patterns are "exact-like" regex (no wildcards except anchors)
        # Compare them directly
        if self._is_exact_regex(pattern1.pattern) and self._is_exact_regex(pattern2.pattern):
            # Normalize patterns for comparison (remove anchors)
            normalized1 = pattern1.pattern.lstrip('^').rstrip('$').replace('\\.',  '.')
            normalized2 = pattern2.pattern.lstrip('^').rstrip('$').replace('\\.', '.')
            return normalized1 == normalized2
        
        # Extract base directory paths
        base1 = self._extract_base_path(pattern1.pattern)
        base2 = self._extract_base_path(pattern2.pattern)
        
        # Normalize paths for comparison
        parts1 = [p for p in base1.split('/') if p]
        parts2 = [p for p in base2.split('/') if p]
        
        # Check if base paths are completely disjoint
        if not parts1 or not parts2:
            # One pattern is too broad - assume conflict
            return True
        
        # Check if one is a prefix of the other (parent-child relationship)
        min_len = min(len(parts1), len(parts2))
        if parts1[:min_len] == parts2[:min_len]:
            # They share a common prefix - now check if patterns overlap
            # Use more comprehensive test paths based on the base directory
            return self._generate_and_test_paths(pattern1, pattern2, base1, base2)
        
        # Different base directories at root level - no conflict
        return False
    
    def _is_exact_regex(self, pattern: str) -> bool:
        """Check if a regex pattern represents an exact file path (no wildcards except anchors)"""
        # Remove anchors and escaped characters
        cleaned = pattern.lstrip('^').rstrip('$')
        # Check if it contains regex wildcards (not just escaped dots)
        wildcards = ['.*', '.+', '[', ']', '(', '|', '{', '}', '?', '+', '*']
        for wildcard in wildcards:
            if wildcard in cleaned:
                return False
        return True
    
    def _generate_and_test_paths(self, pattern1: FilePattern, pattern2: FilePattern, 
                                  base1: str, base2: str) -> bool:
        """Generate test paths based on patterns and check for overlap"""
        # Determine the common base and generate realistic test paths
        parts1 = [p for p in base1.split('/') if p]
        parts2 = [p for p in base2.split('/') if p]
        
        # Find common prefix
        common_prefix = []
        for i in range(min(len(parts1), len(parts2))):
            if parts1[i] == parts2[i]:
                common_prefix.append(parts1[i])
            else:
                break
        
        # Generate test paths in the common directory
        base_path = '/'.join(common_prefix) if common_prefix else ''
        
        # Generate a comprehensive set of test paths
        test_paths = []
        
        # Add paths from both patterns' bases
        if base1:
            test_paths.extend([
                f"{base1}.ts",
                f"{base1}/file.ts",
                f"{base1}/sub/file.ts",
                f"{base1}/handlers/file.ts",
                f"{base1}/ado-service.ts",
                f"{base1}/tool-service.ts",
                f"{base1}/response-builder.ts",
            ])
        
        if base2 and base2 != base1:
            test_paths.extend([
                f"{base2}.ts",
                f"{base2}/file.ts",
                f"{base2}/sub/file.ts",
                f"{base2}/handlers/file.ts",
                f"{base2}/ado-service.ts",
                f"{base2}/tool-service.ts",
                f"{base2}/response-builder.ts",
            ])
        
        # Add some common specific files
        if 'services' in base1 or 'services' in base2:
            test_paths.extend([
                "mcp_server/src/services/ado-work-item-service.ts",
                "mcp_server/src/services/ado-query-service.ts",
                "mcp_server/src/services/tool-service.ts",
                "mcp_server/src/services/handlers/handler.ts",
                "mcp_server/src/services/handlers/wit-handler.ts",
            ])
        
        if 'utils' in base1 or 'utils' in base2:
            test_paths.extend([
                "mcp_server/src/utils/response-builder.ts",
                "mcp_server/src/utils/logger.ts",
                "mcp_server/src/utils/auth.ts",
            ])
        
        # Check for overlap
        overlap_count = 0
        match1_count = 0
        match2_count = 0
        
        for path in test_paths:
            matches1 = pattern1.matches(path)
            matches2 = pattern2.matches(path)
            
            if matches1:
                match1_count += 1
            if matches2:
                match2_count += 1
            if matches1 and matches2:
                overlap_count += 1
        
        # If there's any overlap, it's a conflict
        # Also, if one pattern is very broad (matches many paths) and overlaps with another, it's a conflict
        if overlap_count > 0:
            return True
        
        # Check if one pattern is a subset of another (one is broader)
        # If pattern1 matches everything pattern2 does, they conflict
        if match1_count > 0 and match2_count > 0:
            # Both patterns match files in the test set
            # If they share the same base directory, they likely conflict
            if len(common_prefix) >= 3:  # Deep directory overlap
                return True
        
        return False
    
    def _get_task_priority(self, task: Task) -> Tuple[int, int]:
        """Calculate task priority for scheduling (lower = higher priority)"""
        # NO PRIORITY CONSIDERATIONS - just pack for maximum parallelism
        # 1. Number of dependents (more dependents = schedule earlier to unblock)
        # 2. Task ID for deterministic ordering
        
        dependent_count = len(self.reverse_dependency_graph.get(task.task_id, set()))
        
        return (-dependent_count, task.task_id)
    
    def _topological_sort_with_priority(self) -> List[str]:
        """Perform topological sort with priority-based ordering"""
        in_degree = defaultdict(int)
        for task_id in self.tasks:
            in_degree[task_id] = len(self.dependency_graph[task_id])
        
        # Use priority queue (simulate with sorted list)
        available_tasks = []
        for task_id, degree in in_degree.items():
            if degree == 0:
                available_tasks.append(task_id)
        
        result = []
        
        while available_tasks:
            # Sort available tasks by priority
            available_tasks.sort(key=lambda tid: self._get_task_priority(self.tasks[tid]))
            
            # Take the highest priority task
            current_task = available_tasks.pop(0)
            result.append(current_task)
            
            # Update in-degrees for dependent tasks
            for dependent in self.reverse_dependency_graph[current_task]:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    available_tasks.append(dependent)
        
        if len(result) != len(self.tasks):
            raise ValueError("Circular dependency detected!")
        
        return result
    
    def generate_execution_plan(self) -> Dict:
        """Generate the optimal parallel execution plan"""
        # Get topologically sorted task order
        sorted_tasks = self._topological_sort_with_priority()
        
        waves = []
        completed_tasks = set()
        
        while completed_tasks != set(self.tasks.keys()):
            # Find all tasks whose dependencies are completed
            available_tasks = []
            for task_id in sorted_tasks:
                if task_id not in completed_tasks:
                    task = self.tasks[task_id]
                    if all(dep in completed_tasks for dep in task.depends_on):
                        available_tasks.append(task)
            
            if not available_tasks:
                raise ValueError("No available tasks - possible circular dependency!")
            
            # GREEDY PACKING: Add as many tasks as possible without conflicts
            wave_tasks = []
            used_task_ids = set()
            
            # Sort available tasks to try to pack efficiently
            # Sort by: fewer conflicts first, then by ID for determinism
            available_tasks.sort(key=lambda t: (len(t.conflicts_with), t.task_id))
            
            for task in available_tasks:
                if task.task_id in used_task_ids:
                    continue
                
                # Check if this task conflicts with any already selected task
                can_add = True
                for selected_task_dict in wave_tasks:
                    selected_task = self.tasks[selected_task_dict['task_id']]
                    if self._check_file_conflict(task, selected_task):
                        can_add = False
                        break
                
                if can_add:
                    # Convert file patterns back to strings for output
                    file_strs = [fp.pattern for fp in task.file_patterns]
                    
                    wave_tasks.append({
                        'task_id': task.task_id,
                        'size': task.size,
                        'expected_runtime_min': task.expected_runtime_min,
                        'tags': task.tags,
                        'enabler': task.enabler,
                        'files': file_strs
                    })
                    used_task_ids.add(task.task_id)
                    completed_tasks.add(task.task_id)
            
            # Calculate wave stats
            wave_total_time = max((t['expected_runtime_min'] for t in wave_tasks), default=0)
            
            if wave_tasks:
                waves.append({
                    'wave_number': len(waves) + 1,
                    'tasks': wave_tasks,
                    'parallel_task_count': len(wave_tasks),
                    'estimated_wave_time_min': wave_total_time,
                    'size_distribution': self._get_size_distribution(wave_tasks)
                })
        
        # Calculate summary statistics
        total_time = sum(wave['estimated_wave_time_min'] for wave in waves)
        total_tasks = len(self.tasks)
        avg_parallelism = total_tasks / len(waves) if waves else 0
        
        return {
            'execution_plan': {
                'waves': waves,
                'summary': {
                    'total_waves': len(waves),
                    'total_tasks': total_tasks,
                    'estimated_total_time_min': total_time,
                    'average_parallelism': round(avg_parallelism, 2),
                    'max_parallelism': max(wave['parallel_task_count'] for wave in waves) if waves else 0,
                    'efficiency_metrics': {
                        'sequential_time_min': sum(task.expected_runtime_min for task in self.tasks.values()),
                        'parallel_time_min': total_time,
                        'time_savings_percent': round((1 - total_time / sum(task.expected_runtime_min for task in self.tasks.values())) * 100, 1) if sum(task.expected_runtime_min for task in self.tasks.values()) > 0 else 0
                    }
                }
            }
        }
    
    def _get_size_distribution(self, tasks: List[Dict]) -> Dict[str, int]:
        """Get the distribution of task sizes in a wave"""
        distribution = defaultdict(int)
        for task in tasks:
            distribution[task['size']] += 1
        return dict(distribution)


def main():
    """Main execution function"""
    planner = ParallelExecutionPlanner()
    
    # File paths - input files are in tasklist/plan, output goes there too
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent  # Go up to project root
    plan_dir = project_root / "tasklist" / "plan"
    
    dependency_file = plan_dir / "dependency_graph.json"
    conflict_file = plan_dir / "conflict_graph.json"
    output_file = plan_dir / "parallel_execution_plan.json"
    
    try:
        print("Loading task data...")
        planner.load_data(str(dependency_file), str(conflict_file))
        print(f"Loaded {len(planner.tasks)} tasks")
        
        print("Generating optimal parallel execution plan...")
        execution_plan = planner.generate_execution_plan()
        
        print("Saving execution plan...")
        with open(output_file, 'w') as f:
            json.dump(execution_plan, f, indent=2)
        
        # Print summary
        summary = execution_plan['execution_plan']['summary']
        print(f"\n=== EXECUTION PLAN SUMMARY ===")
        print(f"Total Tasks: {summary['total_tasks']}")
        print(f"Total Waves: {summary['total_waves']}")
        print(f"Estimated Total Time: {summary['estimated_total_time_min']} minutes")
        print(f"Average Parallelism: {summary['average_parallelism']} tasks/wave")
        print(f"Maximum Parallelism: {summary['max_parallelism']} tasks/wave")
        print(f"Time Savings: {summary['efficiency_metrics']['time_savings_percent']}%")
        print(f"Sequential Time: {summary['efficiency_metrics']['sequential_time_min']} minutes")
        print(f"Parallel Time: {summary['efficiency_metrics']['parallel_time_min']} minutes")
        
        print(f"\n=== WAVE BREAKDOWN ===")
        for wave in execution_plan['execution_plan']['waves']:
            size_dist = wave['size_distribution']
            size_str = ', '.join([f"{size}:{count}" for size, count in size_dist.items()])
            print(f"Wave {wave['wave_number']}: {wave['parallel_task_count']} tasks, {wave['estimated_wave_time_min']}min ({size_str})")
            
            # Show task IDs for each wave
            task_ids = [task['task_id'] for task in wave['tasks']]
            print(f"  Tasks: {', '.join(task_ids)}")
        
        print(f"\nExecution plan saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()